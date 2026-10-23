---
covers: [ports/secrets/**]
---

# secrets port

How a sandbox uses a secret it never holds. Decision: [ADR 0054](../../docs/decisions/0054-sandbox-port.md).

## References

The factory definition and the sandbox spec name a secret only by reference: `ref:<provider>/<name>`. A sandbox
holds a placeholder in the secret's variable. Its egress proxy resolves the reference and swaps the placeholder for
the real value on the way out, for the hosts the sandbox may reach. No real value enters a sandbox, a log or a run
record.

## Providers

| Provider | Reference | Where the value comes from | Resolved by |
| --- | --- | --- | --- |
| `file` | `ref:file/linear-token` | The file `linear-token` in the sandbox adapter's `OSF_SECRETS_DIR`, like Docker's and Kubernetes' secret files | [`sandbox-docker`](../../adapters/sandbox/docker/README.md) |
| `env` | `ref:env/LINEAR_TOKEN` | Planned: a variable of the egress proxy's environment | — |
| `openbao` | `ref:openbao/linear-token` | Planned: OpenBao's KV engine, through iron-proxy's `vault_kv` source | — |

A sandbox adapter refuses a reference whose provider it does not resolve before it starts anything. The `env` and
`openbao` providers and this port's own scenarios (prefix `SCN-SECRET`) come with the Kubernetes slice of TODO item
T-13.
