---
status: accepted
date: 2026-10-23
---

# 0054. The sandbox port is a command line; iron-proxy guards each sandbox's egress, secrets and MCP calls

## Context

TODO item T-13 asks for isolated, resource-limited environments for agents with no secrets inside: create a
sandbox from a template with resources and a network policy, run commands in it, copy files, snapshot and destroy
it. Secrets are resolved at an egress proxy, never in the sandbox. An agent reaches only the MCP servers its
definition declares. The vision asks for this in SCN-FACTORY-RUNTIME-003 to -007, OPEN-006 and DATA-004, and the
principles say "no secrets in sandboxes; egress and MCP allowlists per agent" (P11).

Modules may not import adapters (ISOLATION), so foreman cannot call a sandbox adapter as a library. The harness port
solved the same problem with a program that speaks a protocol (ADR 0050). Sandboxes have no common protocol like
ACP: Docker, Kubernetes, E2B and Daytona each have their own API.

## Decision

- **The port is a command line.** A sandbox adapter is a program with six commands. Their shared behavior is the
  `@conformance` scenarios in `ports/sandbox/features/` (prefix `SCN-SANDBOX`):
  - `create <spec.json>` reads a `sandbox-spec` (contracts), starts the sandbox and prints its ID.
  - `exec <ID> -- <command>...` runs a command in the sandbox's working folder `/workspace` and exits with its code.
  - `copy <from> <to>` copies a file or folder into or out of a sandbox; the sandbox side is `<ID>:<path>`.
  - `snapshot <ID>` saves the sandbox's files and prints a template that `create` accepts.
  - `destroy <ID>` removes the sandbox and all its data. `list` prints the IDs of the sandboxes that exist.
  - `egress-log <ID>` prints one JSON line per request that left the sandbox: host, method, path, `allowed` or
    `refused`, what refused it, the MCP server and tool, and the names of the secrets the proxy put in.
- **The `sandbox-spec` format** is new in `contracts/`: `template`, `cpu`, `memory` (a Kubernetes quantity),
  `egress` (hostnames), `env` (plain variables), `secrets` (variable name to secret reference) and `mcp` (servers by
  name with their URL and the tools the agent may call). foreman builds it from an agent's definition; `factory.yaml`
  names MCP servers by registry name, and their URLs come from the registry.
- **Every sandbox gets its own egress proxy: iron-proxy.** The sandbox sits on a network without a route out. Its
  only neighbor is the proxy, and `HTTP_PROXY` and `HTTPS_PROXY` point at it. iron-proxy
  - refuses every host outside `egress` and the MCP servers' hosts with HTTP 403;
  - swaps each secret's placeholder for the real value on the way out, for the hosts of `egress`. The sandbox's
    variable holds `osf-secret-placeholder-<NAME>`, a value worth nothing outside the proxy;
  - refuses a `tools/call` to a declared MCP server for a tool the spec does not list, with a JSON-RPC error, and
    removes such tools from `tools/list`;
  - writes one JSON audit line per request, which `egress-log` reads.

  The proxy terminates TLS with a CA it creates when it starts. The sandbox trusts it through `SSL_CERT_FILE`,
  `NODE_EXTRA_CA_CERTS`, `REQUESTS_CA_BUNDLE`, `CURL_CA_BUNDLE` and `GIT_SSL_CAINFO`; the CA's key stays in the proxy.
- **Secret references resolve at the proxy.** A reference is `ref:<provider>/<name>` (the factory definition's
  `SecretReference`). The first provider is `file`: the file `<name>` in the adapter's `OSF_SECRETS_DIR`, like
  Docker's and Kubernetes' secret files. The Docker CLI copies it into the proxy; the adapter never reads it.
  `env` and `openbao` (iron-proxy's `vault_kv` source, which speaks OpenBao's API) follow with the Kubernetes slice.
  The scheme is described in `ports/secrets/README.md`.
- **The first adapter is `adapters/sandbox/docker`** (`@opensoftware/sandbox-docker`, core). It drives the Docker
  CLI: one container for the sandbox, built from the template image with `--cpus` and `--memory`, one internal
  network, and one iron-proxy container (`ironsh/iron-proxy:0.54.0`, pinned by digest) on that network and on the
  default bridge. Docker names the sandbox: its ID is the first 12 characters of the container's ID. The adapter keeps
  no state of its own; it finds a sandbox's parts by their names and labels. A snapshot is `docker commit`; its
  template is the image ID. The proxy maps `host.docker.internal` to the Docker host, as Docker Desktop does, so a
  sandbox may reach a service on the host when the spec allows that host.
- **The Kubernetes adapter** follows in the next slice of T-13: agent-sandbox's `SandboxTemplate` and
  `SandboxClaim`, iron-proxy as a sidecar or per-namespace proxy, and conformance on kind in CI.
- **testkit:** `fakes.http(routes, { containers: true })` also listens for containers and gives `containerUrl`, the
  same fake at `host.docker.internal`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A command line per adapter, iron-proxy per sandbox | foreman calls any adapter the same way; ISOLATION holds; one proxy does allowlist, secrets and MCP policy | A process per call; output parsed from text and JSON lines |
| An HTTP API per adapter | Typed with OpenAPI; remote | A server to run beside each adapter; Docker and Kubernetes already are APIs, and a second one adds nothing for one caller |
| A TypeScript interface implemented as libraries | Typed calls, no process | Modules may not import adapters (ISOLATION) |
| agentgateway as egress and MCP gateway | Linux Foundation project; rich MCP authorization (CEL) and LLM routing | No placeholder swap for arbitrary APIs; a second component next to an egress proxy |
| Squid or tinyproxy with an allowlist | Mature | No secret swap, no MCP policy; TLS rewriting needs ssl-bump configuration |

## Prior art

- iron-proxy (Apache-2.0, ironsh, active, 0.54.0 from October 2026): a MITM egress proxy for agents and CI with a
  default-deny allowlist, placeholder secrets swapped at egress from env, file, Vault KV, AWS and 1Password
  sources, an MCP tool allowlist and a JSON audit log. Adopted as the egress proxy, the secret resolver and the MCP
  policy of every sandbox. Hermes Agent runs it the same way for its Docker sandboxes.
- agentgateway (Apache-2.0, Linux Foundation, active): an MCP and LLM gateway with CEL authorization per tool.
  Checked, not adopted for now: it does not swap placeholders for arbitrary APIs, and iron-proxy's MCP policy covers
  the per-agent allowlist. It stays the candidate for a shared MCP gateway with registry routing.
- kubernetes-sigs/agent-sandbox (Apache-2.0, SIG Apps, active, v1.0.0 with v1beta1 APIs): `Sandbox`,
  `SandboxTemplate`, `SandboxClaim` and warm pools on Kubernetes with gVisor or Kata. To be adopted by the
  Kubernetes adapter.
- E2B and Daytona (Apache-2.0 and AGPL-3.0, active): hosted and self-hosted sandboxes with their own SDKs. Left to
  community adapters of this port.
- Docker CLI (Apache-2.0): adopted as the Docker adapter's client. dockerode (Apache-2.0, active) was checked: it
  adds a dependency for calls the CLI already makes, and the CLI streams `docker cp` and `docker exec` as the user
  would.
- Cloak (hoophq, MIT, small) and Varlock's credential proxy (MIT, preview): similar placeholder proxies, younger
  than iron-proxy.

## Consequences

- foreman starts any sandbox with one spec and one set of commands, and an agent in it holds no real secret.
- A community adapter is any program that passes `ports/sandbox/features/` with `testkit conformance`.
- Only HTTP and HTTPS leave a sandbox, and only through the proxy. Other protocols (SSH, raw TCP) are blocked; git
  over SSH needs HTTPS instead.
- Secrets are swapped only in headers. A tool that sends a secret in the body or the query needs a later option.
- The proxy sees every request in clear text. Its audit lines carry no header values, and `egress-log` leaves out MCP
  arguments.
- The template image of a Docker sandbox needs `sleep`, `id`, `stat` and `chown`, as any image with a shell has.
- Revisit when agent-sandbox gains an egress proxy of its own, or when iron-proxy's MCP gateway routes by registry
  name.
