---
status: accepted
topic: ports
date: 2026-11-15
---

# 0147. `sandbox-egress` is the egress proxy; the sandbox port's file and copy forms go to contracts

## Context

ADR 0135 gives every published package one job and a listed surface. `@opensoftware/sandbox-egress` (ADR 0055) was
"what every sandbox adapter shares" and exported 17 values: reading the spec and its secrets, iron-proxy's
configuration, start and constants, its log, a memory quantity in bytes, and the ends of `copy`. Some of them have
nothing to do with the egress proxy, two only the library's own tests read, and one only the docker adapter uses.

The split must need no new npm package now: a new package needs a first publish by hand and a trusted publisher set
up by the maintainer. Both sandbox adapters and the sandbox port's `@conformance` scenarios stay as they are.

## Decision

- **`sandbox-egress` has one job: the egress proxy of a sandbox.** From a sandbox spec it gives what an adapter
  needs to start iron-proxy and to point the sandbox at it, and it reads iron-proxy's log. Its surface is seven
  values:

  | Value | What it is |
  | --- | --- |
  | `resolveSecrets` | Where the proxy reads each of the spec's secrets from: a file, a variable or OpenBao |
  | `proxyConfig` | iron-proxy's configuration |
  | `proxyEnv` | the proxy's own variables |
  | `startScript` | the proxy's start script |
  | `EGRESS_PROXY` | the proxy's container: `image`, `dir`, `port`, `ready` (its log line) and `caFile` (where the sandbox finds its CA) |
  | `sandboxEnv` | the sandbox's variables that send it through the proxy: placeholders, `HTTP_PROXY` and the CA |
  | `egressEntries` | the egress log from iron-proxy's audit lines |

- **The sandbox port's forms go to `@opensoftware/contracts`,** which already publishes the format `sandbox-spec`
  and is the place for "shared formats and APIs". Each returns its problems and throws no error of a command line,
  as `validate` does; the adapter turns a problem into its usage error.
  - `readDocument(format, file)` gives the document of a YAML or JSON file and its problems, for every format. The
    adapters read the spec with it; the CLI's `validate` uses it too.
  - `copyEnds(from, to)` gives the two ends of the port's `copy <from> <to>`, whose sandbox side is `<ID>:<path>`,
    or the problem when not exactly one side names a sandbox. The foreman writes that form; the adapters read it.
  - `SANDBOX_WORKSPACE` is `/workspace`, where every command of a sandbox runs (the sandbox port's README).
- **What one platform needs stays in its adapter.** `memoryBytes` moves to the docker adapter: Kubernetes takes the
  quantity as it is written.
- **Values that only the tests read are private.** `placeholder` and `envVariable`: the tests write
  `osf-secret-placeholder-<NAME>` and `OSF_SECRET_<NAME>` as they expect them.

Every export of the library before this decision:

| Export | Where it goes |
| --- | --- |
| `proxyConfig`, `proxyEnv`, `startScript`, `egressEntries` | Stay: iron-proxy's configuration, variables, start and log are the job. |
| `resolveSecrets` | Stays: the proxy resolves a reference; the library says which source it reads, before anything starts. |
| `sandboxEnv` | Stays: the sandbox's side of the proxy, its placeholders, proxy variables and CA. |
| `EGRESS_IMAGE`, `PROXY_DIR`, `EGRESS_PORT`, `READY`, `CA_FILE` | Stay as the fields `image`, `dir`, `port`, `ready` and `caFile` of one value, `EGRESS_PROXY`. |
| `readSpec` | Moves: `readDocument("sandbox-spec", file)` in contracts; each adapter turns its problems into a usage error. |
| `copyEnds` | Moves to contracts, with the same ends; it returns the problem instead of throwing a usage error. |
| `WORKSPACE` | Moves to contracts as `SANDBOX_WORKSPACE`. |
| `memoryBytes` | Moves to the docker adapter, its only user. |
| `placeholder`, `envVariable` | Become private: only the library's own tests read them. |

The scenarios of what moved are `deprecated` in `sandbox-egress` and replaced by scenarios of contracts
(SCN-CTR-017 to SCN-CTR-020). The docker adapter's memory is proven by SCN-SANDBOX-003, which every adapter runs.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The library is the egress proxy; the port's forms go to contracts (chosen) | No new package; each value has one home; the foreman can read the same forms | contracts gets three values of code next to its formats |
| A new library `@opensoftware/sandbox-port` for the spec's file, the copy's ends and the working folder | One job of its own: the port's command line as every adapter reads it, with `UsageError`s of its own | A new package, its first publish and trusted publisher by the maintainer; three small values |
| Two libraries, `sandbox-egress` and `sandbox-spec` | The spec's reading and the secrets next to each other | Resolving a secret is the proxy's job; the spec's reading is one line over `validate` |
| Keep the 17 values and list them | Nothing changes | "What every adapter shares" grows with every adapter; ADR 0135 asks for one job |
| A copy of `copyEnds` and the spec's reading in each adapter | No shared code | DUP refuses a clone across modules, and the two copies drift |

The new library `sandbox-port` is the alternative to revisit when the port's command line gets more shared code
than these three values, or a value that needs a usage error of its own.

## Prior art

No new module, dependency or service. Each reader of a contracts format keeps the small adapter it needs and checks
with `validate`, as the console and `factory-spec` read the access file (ADR 0135). iron-proxy stays pinned as ADR
0054 decided.

## Consequences

- A sandbox adapter imports the proxy from `sandbox-egress` and the port's forms from contracts. A new adapter
  writes its own platform code and names nothing in `sandbox-egress` that is not about the proxy.
- contracts' library grows by `readDocument`, `copyEnds` and `SANDBOX_WORKSPACE`, a minor version; no schema changes.
- Both adapters release with the new `sandbox-egress` (a breaking change before 1.0.0, so a minor version) and the
  new contracts.
- The foreman builds `<ID>:<path>` by hand today; it may use `copyEnds`' form later.
