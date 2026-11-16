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
  proxy fails, and only HTTP and HTTPS leave the sandbox. The network has no gateway address on the Docker host
  (`com.docker.network.bridge.gateway_mode_ipv4` and `_ipv6` set to `isolated`), so a service that listens on the
  host, even on `0.0.0.0`, does not answer the sandbox by any of the host's addresses (SCN-SANDBOX-030).
- **Docker 28.0 or later.** The gateway mode `isolated` came with Docker Engine 28.0. An older daemon refuses the
  option or ignores it; `create` then finds a gateway on the network, removes the sandbox and exits with
  `the sandbox <ID> did not start and was removed: its network has the gateways <addresses> on the Docker host; use
  Docker 28.0 or later` (SCN-SDOCKER-007).
- **A shared network.** With `OSF_SANDBOX_NETWORK`, the egress proxy also joins that Docker network, so an allowed
  host on it resolves by its name: in the Compose profile the sandbox reaches `litellm` this way. The sandbox itself
  stays on its own network.
- **The egress allowlist.** The proxy refuses with HTTP 403 every host that is neither in `egress` nor the host of a
  declared MCP server. It maps `host.docker.internal` to the Docker host, as Docker Desktop does.
- **Secrets.** Each secret's variable holds `osf-secret-placeholder-<NAME>` in the sandbox. The proxy swaps it in any
  request header for the real value, for the hosts of `egress` only, also inside git's Basic credentials in the header
  `Authorization`, so git and `gh` clone and push with the placeholder as their token, for a secret of any provider
  ([ADR 0139](../../../docs/decisions/0139-git-basic-form-value-timing-and-the-check-before-a-stage.md)). A secret from OpenBao is read at the sandbox's first request to an allowed host and kept
  until the sandbox ends. `ref:file/<name>` is the file `<name>` in
  `OSF_SECRETS_DIR`; the Docker CLI copies it into the proxy, and the adapter never reads it. `ref:env/<NAME>` is the
  adapter's variable `OSF_SECRET_<NAME>`, which the Docker CLI hands to the proxy only. `ref:openbao/<path>` is read
  by the proxy from OpenBao with `OSF_OPENBAO_ADDR` and `OSF_OPENBAO_TOKEN` (ADR 0055). Other providers, a missing
  variable and an OpenBao secret without address or token are refused before anything starts.
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
  The spec's `labels` go on the sandbox's container, so `list --label` finds it ([ADR 0158](../../../docs/decisions/0158-no-sandbox-is-left-behind.md)).
- **About 30 sandboxes per Docker host.** Each sandbox takes one bridge network, and Docker's default address pools
  end after about 30 of them: the next `create` fails with "all predefined address pools have been fully subnetted".
  A host that runs more sandboxes at once needs smaller networks from a larger pool, in the daemon's `daemon.json`,
  for example `"default-address-pools": [{"base": "10.200.0.0/16", "size": 28}]` for 4096 networks of 16 addresses.
  The adapter chooses no subnet itself, so it never collides with a network that another client of the daemon made.

## Commands

| Command | What it does |
| --- | --- |
| `sandbox-docker create <spec.json>` | Start a sandbox from the spec and print its ID. A spec that is not a valid `sandbox-spec`, or a secret that cannot be resolved, exits 2 before anything starts. |
| `sandbox-docker exec <ID> -- <command>...` | Run the command in `/workspace` and exit with its code. |
| `sandbox-docker copy <from> <to>` | Copy a file or folder into or out of a sandbox. The sandbox's side is `<ID>:<path>`; a relative path is below `/workspace`. What is copied in belongs to the sandbox's user. |
| `sandbox-docker snapshot <ID>` | Save the sandbox's files with `docker commit` and print the image ID, a template for `create`. |
| `sandbox-docker destroy <ID>` | Remove the sandbox, its files, its network and its egress proxy. A part that is gone already is no failure; a part that Docker does not remove, like a network whose removal the socket proxy refuses, exits 1 with `the sandbox <ID> was not removed: the network osf-sandbox-<ID>: ` and Docker's error. |
| `sandbox-docker list [--label <name>=<value>]` | Print the IDs of the sandboxes on the Docker host; with `--label`, only those whose spec carried the label. |
| `sandbox-docker egress-log <ID>` | Print one JSON line per request that left the sandbox. |
| `sandbox-docker probe <template> <host>` | Start a sandbox from the template with no allowed host, send one HTTPS request to the host with `curl`, remove the sandbox, and print `refused <host>` when its egress proxy refused the request, else `reached <host>`. The deep check `sandbox` of `console doctor --deep` runs it (ADR 0120). |

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
| `OSF_SECRET_*` | string |  | OSF_SECRET_<NAME> holds the value of ref:env/<NAME> in a sandbox spec. The Docker CLI hands it to the sandbox's egress proxy only, as its variable <NAME>. |
| `OSF_OPENBAO_ADDR` | string |  | OpenBao's address for ref:openbao/<path>, as the egress proxy reaches it. Needed only for such secrets. |
| `OSF_OPENBAO_TOKEN` | string |  | The token the egress proxy reads OpenBao with. The sandbox never gets it. |
| `OSF_OPENBAO_MOUNT` | string | `"secret"` | The KV v2 mount of ref:openbao/<path>: the secret's field value at <mount>/data/<path>. |
| `DOCKER_HOST` | string |  | The Docker daemon to use, as for any docker command. Default: the Docker CLI's current context. |
| `OSF_SANDBOX_NETWORK` | string |  | A Docker network the egress proxy of each sandbox also joins, like the Compose profile's network, so a host on it that the spec's egress allows, like litellm, resolves. The sandbox itself stays on its own network. |
