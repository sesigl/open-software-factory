---
covers: [ports/secrets/**]
---

# secrets port

How a sandbox uses a secret it never holds. Decisions: [ADR 0054](../../docs/decisions/0054-sandbox-port.md) and
[ADR 0055](../../docs/decisions/0055-sandbox-kubernetes.md).

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
[`ports/sandbox/features/secrets.feature`](../sandbox/features/secrets.feature). The prefix `SCN-SECRET` stays for a
secrets adapter of its own.

The inference adapter [`litellm`](../../adapters/inference/litellm/README.md) uses the same prefix for provider
keys: a LiteLLM config names them as `os.environ/OSF_SECRET_<NAME>`, and the adapter hands only those variables to
the gateway (ADR 0056).
