---
covers: [adapters/sandbox/kubernetes/src/**]
---

# sandbox-kubernetes

Runs isolated, resource-limited sandboxes on Kubernetes behind the factory's sandbox port. Each sandbox is a pod of
[agent-sandbox](https://github.com/kubernetes-sigs/agent-sandbox), started from a `SandboxClaim`. A NetworkPolicy
lets it reach only its own egress pod, an [iron-proxy](https://github.com/ironsh/iron-proxy) that refuses every host
the spec does not allow, puts the real secrets in on the way out, and lets the sandbox call only the declared tools
of the declared MCP servers. Decisions: [ADR 0054](../../../docs/decisions/0054-sandbox-port.md) and
[ADR 0055](../../../docs/decisions/0055-sandbox-kubernetes.md). The port's scenarios are in
[`ports/sandbox/features/`](../../../ports/sandbox/features/sandbox.feature).

## Quick start

The cluster needs agent-sandbox with its extensions and a network plugin that enforces NetworkPolicies:

```sh
kubectl apply -f https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v1.0.8/sandbox-with-extensions.yaml
```

Write a sandbox spec (the format `sandbox-spec` in [contracts](../../../contracts/README.md)). The `template` is an
image, or the name of a `SandboxTemplate` in the namespace, such as one `factory render --k8s` writes:

```json
{
  "template": "node:24-alpine",
  "cpu": 2,
  "memory": "4Gi",
  "egress": ["api.linear.app", "registry.npmjs.org"],
  "secrets": { "LINEAR_TOKEN": "ref:env/LINEAR_TOKEN" },
  "mcp": [{ "name": "wiki", "url": "https://wiki.example.com/mcp", "tools": ["search"] }]
}
```

Then:

```sh
export OSF_SANDBOX_NAMESPACE=sandboxes OSF_SECRET_LINEAR_TOKEN=...
id=$(npx @opensoftware/sandbox-kubernetes create spec.json)
npx @opensoftware/sandbox-kubernetes exec "$id" -- npm test
npx @opensoftware/sandbox-kubernetes egress-log "$id"
npx @opensoftware/sandbox-kubernetes destroy "$id"
```

## How it behaves

- **The sandbox** is the pod of a `SandboxClaim` `osf-sandbox-<ID>`. The adapter writes a `SandboxTemplate` and a
  `SandboxWarmPool` with no replicas of the same name; agent-sandbox's controller makes the `Sandbox` and its pod.
  The first container runs `sleep infinity` in `/workspace`, an `emptyDir`, with the spec's CPU and memory as
  requests and limits, the spec's variables, and no privilege escalation. The ID is 12 random hex digits.
- **The template** is an image when it holds `/`, `:` or `@`, which no Kubernetes name does. Otherwise it names a
  `SandboxTemplate` in the namespace, whose pod the adapter copies; if there is none, `create` exits 1 before
  anything starts.
- **No way out but the proxy.** The template's NetworkPolicy lets the sandbox reach only its egress pod on port 8080
  and the cluster DNS. `HTTP_PROXY` and `HTTPS_PROXY` point at `http://osf-sandbox-<ID>-egress:8080`, the egress pod's
  Service. A request around the proxy fails.
- **The egress allowlist.** The proxy refuses with HTTP 403 every host that is neither in `egress` nor the host of a
  declared MCP server. `OSF_SANDBOX_HOST_ALIASES` maps hostnames to addresses in the egress pod only.
- **Secrets.** Each secret's variable holds `osf-secret-placeholder-<NAME>` in the sandbox. The proxy swaps it in any
  request header for the real value, for the hosts of `egress` only. The sources:
  - `ref:file/<name>` is the file `<name>` in `OSF_SECRETS_DIR`. kubectl puts it into a Secret that only the egress pod
    mounts; the adapter never reads it.
  - `ref:env/<NAME>` is the adapter's variable `OSF_SECRET_<NAME>`, handed to the egress pod in a Secret.
  - `ref:openbao/<path>` is the field `value` of the KV v2 secret `<path>` in OpenBao, which the proxy reads with
    `OSF_OPENBAO_ADDR` and `OSF_OPENBAO_TOKEN`. The sandbox gets neither.
  - Other providers, a missing variable and an OpenBao secret without address or token exit 2 before anything starts.
- **TLS.** The proxy creates its own CA when it starts and terminates TLS with it. The adapter puts the CA's
  certificate into a ConfigMap that the sandbox mounts at `/etc/osf/egress-ca.crt`, and `SSL_CERT_FILE`,
  `NODE_EXTRA_CA_CERTS`, `REQUESTS_CA_BUNDLE`, `CURL_CA_BUNDLE` and `GIT_SSL_CAINFO` point at it. The CA's key never
  leaves the egress pod.
- **MCP servers.** A `tools/call` to a declared server for a tool outside its `tools` gets a JSON-RPC error and never
  reaches the server; `tools/list` answers leave such tools out.
- **The egress log** has one JSON line per request, as for every sandbox adapter: `host`, `method`, `path`,
  `outcome`, `refusedBy`, `mcpServer`, `tool` and `secrets`. It holds no header values and no MCP arguments.
- **A sandbox that does not start** (an image that cannot be pulled, a container that exits) is removed, and `create`
  exits 1 with the reason.
- **No state of its own.** The cluster holds every part of a sandbox, labelled `osf.sandbox.id=<ID>`. `destroy`
  removes them all; a snapshot stays.

## Commands

| Command | What it does |
| --- | --- |
| `sandbox-kubernetes create <spec.json>` | Start a sandbox from the spec and print its ID. A spec that is not a valid `sandbox-spec`, or a secret that cannot be resolved, exits 2 before anything starts. |
| `sandbox-kubernetes exec <ID> -- <command>...` | Run the command in `/workspace` and exit with its code. |
| `sandbox-kubernetes copy <from> <to>` | Copy a file or folder into or out of a sandbox with `kubectl cp`. The sandbox's side is `<ID>:<path>`; a relative path is below `/workspace`. |
| `sandbox-kubernetes snapshot <ID>` | Copy the sandbox's `/workspace` into a PersistentVolumeClaim of `OSF_SANDBOX_SNAPSHOT_SIZE` and print the name of a `SandboxTemplate` that starts with it, a template for `create`. |
| `sandbox-kubernetes destroy <ID>` | Remove the sandbox, its files and its egress pod. |
| `sandbox-kubernetes list` | Print the IDs of the sandboxes in the namespace. |
| `sandbox-kubernetes egress-log <ID>` | Print one JSON line per request that left the sandbox. |

An unknown sandbox ID exits 1 with `no sandbox <ID>`. A snapshot keeps only `/workspace`. Its claim is
`ReadWriteOnce`, so sandboxes from one snapshot run on one node.

## Releases

release-please opens a release pull request from the Conventional Commits under `adapters/sandbox/kubernetes/`.
Merging it creates the tag `sandbox-kubernetes-v<version>`. The workflow
`.github/workflows/publish-sandbox-kubernetes.yml` then builds the package and publishes it to npm as
`@opensoftware/sandbox-kubernetes`. The first release is `0.1.0`; until `1.0.0`, a breaking change raises the minor
version. The one-time setup is the same as for contracts ([`contracts/README.md`](../../../contracts/README.md#releases)).
No credential is stored in the repository.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `KUBECONFIG` | string |  | The kubeconfig of the cluster, as for any kubectl command. Default: kubectl's own (~/.kube/config). The cluster needs agent-sandbox with its extensions. |
| `OSF_SANDBOX_NAMESPACE` | string | `"default"` | The namespace of the sandboxes, their egress pods and their Secrets. Give sandboxes a namespace of their own. |
| `OSF_SECRETS_DIR` | string | `"/run/secrets"` | Folder of the secret files: ref:file/<name> in a sandbox spec is the file <name> in it. kubectl puts each into a Secret that only the sandbox's egress pod mounts; the adapter never reads it. |
| `OSF_SECRET_*` | string |  | OSF_SECRET_<NAME> holds the value of ref:env/<NAME> in a sandbox spec. It goes into a Secret that only the sandbox's egress pod gets, as its variable <NAME>. |
| `OSF_OPENBAO_ADDR` | string |  | OpenBao's address for ref:openbao/<path>, as the egress pod reaches it. Needed only for such secrets. |
| `OSF_OPENBAO_TOKEN` | string |  | The token the egress proxy reads OpenBao with. The sandbox never gets it. |
| `OSF_OPENBAO_MOUNT` | string | `"secret"` | The KV v2 mount of ref:openbao/<path>: the secret's field value at <mount>/data/<path>. |
| `OSF_SANDBOX_HOST_ALIASES` | string |  | Hostnames the egress pod resolves to fixed addresses, as host=ip pairs separated by commas, such as host.docker.internal=172.18.0.1 on kind. |
| `OSF_SANDBOX_SNAPSHOT_SIZE` | string | `"1Gi"` | The size of the PersistentVolumeClaim that snapshot copies /workspace into. |
