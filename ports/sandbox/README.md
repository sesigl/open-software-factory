---
covers: [ports/sandbox/**]
---

# sandbox port

How the factory runs an agent's commands in an isolated, resource-limited environment with no secrets inside: one
command line for every sandbox platform. Decision: [ADR 0054](../../docs/decisions/0054-sandbox-port.md).

## The interface

A sandbox adapter is a program with these commands. Its client (foreman, a script, a test) runs them as any
command line:

| Port operation | Command |
| --- | --- |
| create(template, resources, network policy) | `<adapter> create <spec.json>` prints the sandbox's ID |
| exec | `<adapter> exec <ID> -- <command>...` runs in `/workspace` and exits with the command's code |
| copy | `<adapter> copy <from> <to>`, the sandbox's side written `<ID>:<path>` |
| snapshot | `<adapter> snapshot <ID>` prints a template that `create` accepts |
| destroy | `<adapter> destroy <ID>` removes the sandbox and all its data |
| list | `<adapter> list` prints the IDs of the sandboxes |
| egress log | `<adapter> egress-log <ID>` prints one JSON line per request that left the sandbox |

The spec is the format `sandbox-spec` in [contracts](../../contracts/README.md): `template`, `cpu`, `memory`,
`egress`, `env`, `secrets` and `mcp`. An unknown sandbox ID exits 1 with `no sandbox <ID>`.

## What every adapter guarantees

- The sandbox gets the spec's CPU and memory.
- Every request that leaves the sandbox passes its egress proxy. The proxy refuses hosts outside `egress` and the
  MCP servers' hosts, and a request around the proxy does not leave the sandbox.
- The sandbox holds a placeholder for each secret, never the real value. The proxy puts the real value in on the way
  out, for the hosts of `egress`. Secret references follow the [secrets port](../secrets/README.md).
- A call to an MCP server that the spec does not declare, or to a tool it does not list, is refused and logged.
- `destroy` removes the sandbox's files.

## Conformance

The shared behavior is the `@conformance` scenarios in [`features/`](features/sandbox.feature) (prefix
`SCN-SANDBOX`), with the secret providers in [`features/secrets.feature`](features/secrets.feature). Every adapter in `adapters/sandbox/<name>/` has one system test per scenario; what only one adapter
does is in its own `features/` folder. A community adapter shows conformance with
`testkit conformance <its copy of this features folder> --junit report.xml`. The scenarios' APIs and MCP servers are
`fakes.http(routes, { containers: true })` at `host.docker.internal`. What every adapter shares, the spec, the
secrets, iron-proxy's configuration and the egress log, is the library
[`@opensoftware/sandbox-egress`](../../packages/sandbox-egress/README.md) (ADR 0055).

## Adapters

| Adapter | Tier | What it runs |
| --- | --- | --- |
| [`docker`](../../adapters/sandbox/docker/README.md) | core | A container per sandbox behind an iron-proxy container on an internal network |
| [`kubernetes`](../../adapters/sandbox/kubernetes/README.md) | optional | An agent-sandbox `SandboxClaim` per sandbox whose NetworkPolicy lets it reach only its iron-proxy egress pod; conformance on kind in CI |
