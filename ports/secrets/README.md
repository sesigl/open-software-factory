---
covers: [ports/secrets/**]
---

# secrets port

How a sandbox uses a secret it never holds, and how a person stores its value without anyone reading it back.
Decisions: [ADR 0054](../../docs/decisions/0054-sandbox-port.md),
[ADR 0055](../../docs/decisions/0055-sandbox-kubernetes.md) and
[ADR 0137](../../docs/decisions/0137-secrets-port-write-side-and-openbao.md).

## References

The factory definition and the sandbox spec name a secret only by reference: `ref:<provider>/<name>`. A sandbox
holds a placeholder in the secret's variable. Its egress proxy resolves the reference and swaps the placeholder for
the real value on the way out, for the hosts the sandbox may reach. No real value enters a sandbox, a log or a run
record.

## Providers

| Provider | Reference | Where the value comes from | Resolved by |
| --- | --- | --- | --- |
| `file` | `ref:file/linear-token` | The file `linear-token` in the sandbox adapter's `OSF_SECRETS_DIR`, like Docker's and Kubernetes' secret files | [`sandbox-docker`](../../adapters/sandbox/docker/README.md), [`sandbox-kubernetes`](../../adapters/sandbox/kubernetes/README.md) |
| `env` | `ref:env/LINEAR_TOKEN` | The sandbox adapter's variable `OSF_SECRET_LINEAR_TOKEN`, handed to the egress proxy only | both |
| `openbao` | `ref:openbao/linear-token` | The field `value` of the KV v2 secret `linear-token` in OpenBao (mount `OSF_OPENBAO_MOUNT`, default `secret`), which the egress proxy reads with `OSF_OPENBAO_ADDR` and `OSF_OPENBAO_TOKEN` through iron-proxy's `vault_kv` source | both |

A sandbox adapter refuses, before it starts anything, a reference to another provider, an `env` reference whose
variable is not set, and an `openbao` reference without OpenBao's address or token. The `OSF_SECRET_` prefix keeps a
sandbox spec from naming any other variable of the adapter. The sandbox adapters resolve every provider, so the
scenarios are the sandbox port's `@conformance` scenarios in
[`ports/sandbox/features/secrets.feature`](../sandbox/features/secrets.feature).

The inference adapter [`litellm`](../../adapters/inference/litellm/README.md) uses the same prefix for provider
keys: a LiteLLM config names them as `os.environ/OSF_SECRET_<NAME>`, and the adapter hands only those variables to
the gateway (ADR 0056).

## The write side

A secrets adapter is a program with these commands. Its client (the console, a script, a test) runs them as any
command line. Every command prints JSON lines. No command prints a value, and no error names one.

| Port operation | Command |
| --- | --- |
| store a value | `<adapter> put <name> --by <person>` reads the value from standard input, without its final line break, stores it as a new version and prints `{"name", "version"}` |
| list | `<adapter> list` prints one `{"name", "version", "changed", "by"}` per secret, sorted by name |
| delete | `<adapter> delete <name>` removes the secret with every version and prints `{"name", "deleted"}` |
| probe | `<adapter> probe` checks that the store answers to the token and prints `{"ttl", "expires"}` |

`version` counts from 1 and grows with each `put`. `changed` is the time of the current version in ISO 8601, `by` the
person that `put` named, or `null` for a secret that another client stored. A name may hold `/`, so `list` walks the
folders. `deleted` is false when the store had no such secret. `ttl` is how many seconds the token still lives, and
`expires` the time it ends.

The value never goes in an argument or a variable: those show in `ps`, in a process's environment and in a shell's
history. Pipe it, as `printf %s "$VALUE" | <adapter> put linear-token --by ada`.

### What every adapter guarantees

- A name follows the pattern of `SecretReference` in
  [`contracts/typespec/factory-definition.tsp`](../../contracts/typespec/factory-definition.tsp): `A-Z`, `a-z`, `0-9`,
  `_`, `.` and `-` in folders split by `/`, with no empty, `.` or `..` folder. Any other name, an empty value and a
  `put` without `--by` exit 2 before any request.
- A store that does not answer exits 1 with `the store at <address> does not answer`; a token it does not know exits
  1 with `the store refused the token`; a token without the right exits 1 with `the token may not write "<name>"`,
  `the token may not delete "<name>"` or `the token may not list the secrets`.
- **Two tokens.** The write token, the console's, may write, list and delete secrets and read their metadata; the
  store refuses it a value. The read token, the egress proxy's, may only read. So a fault in the console cannot show
  a secret. Each adapter says how its store gives a token these rights.

### Conformance

The shared behavior is the `@conformance` scenarios in [`features/`](features/secrets.feature) (prefix
`SCN-SECRET`). Every adapter in `adapters/secrets/<name>/` has one system test per scenario. The test store of
`openbao` is the testkit's `fakes.openbao`, the real OpenBao in development mode.

### Adapters

| Adapter | Tier | What it calls |
| --- | --- | --- |
| [`openbao`](../../adapters/secrets/openbao/README.md) | core | OpenBao's HTTP API, KV version 2 |
