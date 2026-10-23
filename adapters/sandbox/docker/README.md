---
covers: [adapters/sandbox/docker/src/**]
---

# sandbox-docker

Runs isolated, resource-limited sandboxes on Docker behind the factory's sandbox port. Each sandbox is a container on
a network of its own. Its only way out is an [iron-proxy](https://github.com/ironsh/iron-proxy) container that
refuses every host the spec does not allow, puts the real secrets in on the way out, and lets the sandbox call only
the declared tools of the declared MCP servers. Decision: [ADR 0054](../../../docs/decisions/0054-sandbox-port.md).
The port's scenarios are in [`ports/sandbox/features/`](../../../ports/sandbox/features/sandbox.feature).

## Quick start

Write a sandbox spec (the format `sandbox-spec` in [contracts](../../../contracts/README.md)):

```json
{
  "template": "node:24-alpine",
  "cpu": 2,
  "memory": "4Gi",
  "egress": ["api.linear.app", "registry.npmjs.org"],
  "secrets": { "LINEAR_TOKEN": "ref:file/linear-token" },
  "mcp": [{ "name": "wiki", "url": "https://wiki.example.com/mcp", "tools": ["search"] }]
}
```

Put the real token into `/run/secrets/linear-token` (or the folder in `OSF_SECRETS_DIR`), then:

```sh
id=$(npx @opensoftware/sandbox-docker create spec.json)
npx @opensoftware/sandbox-docker exec "$id" -- npm test
npx @opensoftware/sandbox-docker egress-log "$id"
npx @opensoftware/sandbox-docker destroy "$id"
```

## How it behaves

- **The sandbox** is a container of the spec's `template` image with `--cpus` and `--memory` from the spec, the
  working folder `/workspace` owned by the image's user, and `no-new-privileges`. Its ID is the first 12 hex digits of
  the container's ID. The image needs `sleep`, `id`, `stat` and `chown`, as any image with a shell has.
- **No way out but the proxy.** The sandbox's network is internal: it has no route to anywhere but its egress proxy,
  which it reaches as `egress`. `HTTP_PROXY` and `HTTPS_PROXY` point at `http://egress:8080`. A request around the
  proxy fails, and only HTTP and HTTPS leave the sandbox.
- **The egress allowlist.** The proxy refuses with HTTP 403 every host that is neither in `egress` nor the host of a
  declared MCP server. It maps `host.docker.internal` to the Docker host, as Docker Desktop does.
- **Secrets.** Each secret's variable holds `osf-secret-placeholder-<NAME>` in the sandbox. The proxy swaps it in any
  request header for the real value, for the hosts of `egress` only. `ref:file/<name>` is the file `<name>` in
  `OSF_SECRETS_DIR`; the Docker CLI copies it into the proxy, and the adapter never reads it. Other providers are
  refused before anything starts.
- **TLS.** The proxy creates its own CA when it starts and terminates TLS with it, so it can swap secrets in HTTPS
  requests. The sandbox trusts the CA through `SSL_CERT_FILE`, `NODE_EXTRA_CA_CERTS`, `REQUESTS_CA_BUNDLE`,
  `CURL_CA_BUNDLE` and `GIT_SSL_CAINFO`, all `/etc/osf/egress-ca.crt`. The CA's key never leaves the proxy.
- **MCP servers.** A `tools/call` to a declared server for a tool outside its `tools` gets a JSON-RPC error and never
  reaches the server; `tools/list` answers leave such tools out. A call to any other MCP server is refused like any
  host outside the allowlist.
- **The egress log** has one JSON line per request: `host`, `method`, `path`, `outcome` (`allowed` or `refused`),
  `refusedBy` (`allowlist`, `mcp`, ...), `mcpServer` and `tool` for MCP calls, and `secrets`, the variables whose
  placeholders the proxy swapped. It holds no header values and no MCP arguments.
- **No state of its own.** The Docker host holds every part of a sandbox: the container `osf-sandbox-<ID>`, the
  network of the same name and the proxy `osf-sandbox-<ID>-egress`. `destroy` removes all three; a snapshot stays.

## Commands

| Command | What it does |
| --- | --- |
| `sandbox-docker create <spec.json>` | Start a sandbox from the spec and print its ID. A spec that is not a valid `sandbox-spec`, or a secret that cannot be resolved, exits 2 before anything starts. |
| `sandbox-docker exec <ID> -- <command>...` | Run the command in `/workspace` and exit with its code. |
| `sandbox-docker copy <from> <to>` | Copy a file or folder into or out of a sandbox. The sandbox's side is `<ID>:<path>`; a relative path is below `/workspace`. What is copied in belongs to the sandbox's user. |
| `sandbox-docker snapshot <ID>` | Save the sandbox's files with `docker commit` and print the image ID, a template for `create`. |
| `sandbox-docker destroy <ID>` | Remove the sandbox, its files, its network and its egress proxy. |
| `sandbox-docker list` | Print the IDs of the sandboxes on the Docker host. |
| `sandbox-docker egress-log <ID>` | Print one JSON line per request that left the sandbox. |

An unknown sandbox ID exits 1 with `no sandbox <ID>`.

## Releases

release-please opens a release pull request from the Conventional Commits under `adapters/sandbox/docker/`. Merging
it creates the tag `sandbox-docker-v<version>`. The workflow `.github/workflows/publish-sandbox-docker.yml` then
builds the package and publishes it to npm as `@opensoftware/sandbox-docker`. The first release is `0.1.0`; until
`1.0.0`, a breaking change raises the minor version. The one-time setup is the same as for contracts
([`contracts/README.md`](../../../contracts/README.md#releases)). No credential is stored in the repository.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `OSF_SECRETS_DIR` | string | `"/run/secrets"` | Folder of the secret files: ref:file/<name> in a sandbox spec is the file <name> in it. The Docker CLI copies each into the sandbox's egress proxy; the adapter never reads it. |
| `DOCKER_HOST` | string |  | The Docker daemon to use, as for any docker command. Default: the Docker CLI's current context. |
