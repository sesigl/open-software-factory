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
| probe | `<adapter> probe <template> <host> [--allow]` starts a sandbox from the template with no allowed host (with `--allow`, only the host), sends one HTTPS request to the host, removes the sandbox and prints `refused <host>` or `reached <host>`; standard error names the sandbox, `sandbox <id>` |

`probe` is the deep check of `console doctor --deep` (ADR 0120). It prints `refused <host>` only when the egress log
holds a refused request; otherwise `reached <host>`. With `--allow` the host is in the sandbox's egress allowlist, so
the probe shows the other side: an allowed host is `reached` even when it does not answer. Both exit 0; a missing host
or one with characters other than letters, digits, dots and hyphens exits 2 with the usage before a sandbox starts; a sandbox that does not start exits 1
with the reason. The template needs `curl`.

The spec is the format `sandbox-spec` in [contracts](../../contracts/README.md): `template`, `cpu`, `memory`,
`egress`, `env`, `secrets` and `mcp`. An unknown sandbox ID exits 1 with `no sandbox <ID>`.

## What every adapter guarantees

- The sandbox gets the spec's CPU and memory.
- Every request that leaves the sandbox passes its egress proxy. The proxy refuses hosts outside `egress` and the
  MCP servers' hosts, and a request around the proxy does not leave the sandbox: not by a name, and not by any
  address of the host that runs the sandboxes, where a service may listen on every interface (SCN-SANDBOX-030).
- The sandbox holds a placeholder for each secret, never the real value. The proxy puts the real value in on the way
  out, for the hosts of `egress`, in any header and also inside git's Basic credentials `<user>:<placeholder>`, so git
  and `gh` clone and push with the placeholder as their token, whatever the secret's provider
  ([ADR 0139](../../docs/decisions/0139-git-basic-form-value-timing-and-the-check-before-a-stage.md)). Secret references follow the [secrets port](../secrets/README.md).
- A secret from OpenBao reaches a sandbox at its first request to an allowed host and keeps that value until the
  sandbox ends: a new value reaches the sandboxes that start after it is stored (SCN-SANDBOX-029).
- A call to an MCP server that the spec does not declare, or to a tool it does not list, is refused and logged.
- `destroy` removes the sandbox's files.

## Conformance

The shared behavior is the `@conformance` scenarios in [`features/`](features/sandbox.feature) (prefix
`SCN-SANDBOX`), with the secret providers in [`features/secrets.feature`](features/secrets.feature). Every adapter in `adapters/sandbox/<name>/` has one system test per scenario; what only one adapter
does is in its own `features/` folder. A community adapter shows conformance with
`testkit conformance <its copy of this features folder> --junit report.xml`. The scenarios' APIs and MCP servers are
`fakes.http(routes, { containers: true })` at `host.docker.internal`; OpenBao is `fakes.openbao({ containers: true })`,
the real server, except in the scenarios whose steps name the request OpenBao received. What every adapter shares about the egress proxy, its
secrets, iron-proxy's configuration and the egress log, is the library
[`@opensoftware/sandbox-egress`](../../packages/sandbox-egress/README.md) (ADR 0055). The adapters read the spec
with `readDocument` and the ends of `copy` with `copyEnds` of [contracts](../../contracts/README.md), where the
working folder `/workspace` is `SANDBOX_WORKSPACE` ([ADR 0147](../../docs/decisions/0147-sandbox-egress-is-the-egress-proxy.md)).

## Adapters

| Adapter | Tier | What it runs |
| --- | --- | --- |
| [`docker`](../../adapters/sandbox/docker/README.md) | core | A container per sandbox behind an iron-proxy container on an internal network |
| [`kubernetes`](../../adapters/sandbox/kubernetes/README.md) | optional | An agent-sandbox `SandboxClaim` per sandbox whose NetworkPolicy lets it reach only its iron-proxy egress pod; conformance on kind in CI |
