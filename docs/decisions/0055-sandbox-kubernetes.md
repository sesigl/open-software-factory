---
status: accepted
date: 2026-10-23
---

# 0055. The kubernetes sandbox adapter runs agent-sandbox claims behind iron-proxy; env and OpenBao secrets

## Context

TODO item T-13 asks for a second sandbox adapter on Kubernetes with kubernetes-sigs/agent-sandbox, conformance on
kind in CI, the secret providers `env` and `openbao`, and `factory render --k8s` writing an agent-sandbox
`SandboxTemplate` for each agent's sandbox (ADR 0022). ADR 0054 made the sandbox port a command line and gave every
sandbox its own iron-proxy for egress, secrets and MCP policy. The docker adapter holds that proxy's configuration,
the secret references and the egress log in its own `domain` layer. A second adapter needs the same code, and DUP
allows no clone across units.

## Decision

- **A library for what every sandbox adapter shares: `packages/sandbox-egress`** (`@opensoftware/sandbox-egress`,
  prefix `SCN-SEGRESS`). It reads and checks a sandbox spec, resolves its secret references, writes iron-proxy's
  configuration and start script, gives the sandbox's environment and turns iron-proxy's audit lines into the egress
  log. It does no I/O but reading the spec and checking that a secret's file exists. The docker adapter's `domain`
  code moves into it unchanged in behavior.
- **Two more secret providers**, resolved by iron-proxy and by every sandbox adapter:
  - `ref:env/<NAME>` is the adapter's variable `OSF_SECRET_<NAME>`. The prefix keeps a sandbox spec from naming any
    other variable of the adapter, such as its own OpenBao token. The adapter hands the value to the egress proxy
    only, as the proxy's variable `<NAME>` (iron-proxy's `env` source).
  - `ref:openbao/<path>` is the field `value` of the KV v2 secret `<path>` in OpenBao, in the mount
    `OSF_OPENBAO_MOUNT` (default `secret`), at `OSF_OPENBAO_ADDR` with the token `OSF_OPENBAO_TOKEN` (iron-proxy's
    `vault_kv` source with `json_key: value`). The proxy gets the address and the token as `VAULT_ADDR` and
    `VAULT_TOKEN`; the sandbox gets neither.
  - A reference to a provider the adapter does not know, a missing `OSF_SECRET_<NAME>`, or an `openbao` reference
    without address or token is refused before anything starts.

  Their scenarios are `@conformance` scenarios of the sandbox port (`ports/sandbox/features/secrets.feature`), since
  sandbox adapters resolve them. The prefix `SCN-SECRET` stays for a secrets adapter of its own.
- **The adapter `adapters/sandbox/kubernetes`** (`@opensoftware/sandbox-kubernetes`, optional) drives `kubectl`
  against the cluster of `KUBECONFIG`, in the namespace `OSF_SANDBOX_NAMESPACE`. Per sandbox it creates:
  - an egress pod with iron-proxy and a Service, both `osf-sandbox-<ID>-egress`, with the proxy's configuration in a
    ConfigMap and the secrets in Secrets that only this pod mounts;
  - a ConfigMap with the proxy's CA, which the sandbox mounts at `/etc/osf/`;
  - a `SandboxTemplate`, a `SandboxWarmPool` with no replicas and a `SandboxClaim`, all `osf-sandbox-<ID>`.
    agent-sandbox's controller makes the `Sandbox` and its pod from them. The template sets the spec's CPU and memory
    as requests and limits, the spec's variables, `/workspace` as an `emptyDir` and the working folder, and a
    NetworkPolicy that lets the sandbox reach only its egress pod and the cluster DNS.

  The spec's `template` names a `SandboxTemplate` in the namespace, whose pod the adapter copies, or an image (a name
  with `/`, `:` or `@`, which no Kubernetes name has). The ID is 12 random hex digits. `snapshot` copies `/workspace`
  into a PersistentVolumeClaim of `OSF_SANDBOX_SNAPSHOT_SIZE` and prints the name of a new `SandboxTemplate` whose
  init container copies it back. `OSF_SANDBOX_HOST_ALIASES` maps hostnames to IP addresses in the egress pod, so a
  kind cluster can reach `host.docker.internal` as Docker does.
- **Conformance on kind in CI.** The suite `sandbox-kubernetes` starts kind with agent-sandbox v1.0.8
  (`sandbox-with-extensions.yaml`), loads the test images into kind and runs the port's scenarios. The test gets the
  cluster through `KUBECONFIG` and the host's address on kind's network through `OSF_SANDBOX_HOST_ALIASES`.
- **`factory render --k8s` writes a `SandboxTemplate`** named after each agent that declares `sandbox`: one
  container `sandbox` with the image `sandbox.template` and the CPU and memory as requests and limits. foreman names
  it as the spec's `template` on Kubernetes.
- **testkit:** a name in a README's configuration written as `` `OSF_SECRET_*` `` documents every variable with that
  prefix (BOUNDARY-ENV).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| agent-sandbox template, warm pool and claim per sandbox | agent-sandbox's own lifecycle, NetworkPolicy and pod; warm pools later | Three objects per sandbox; a claim needs a warm pool even with no replicas |
| A `Sandbox` object per sandbox | One object | The template's managed NetworkPolicy and the claim's lifecycle are lost |
| iron-proxy as a sidecar in the sandbox's pod | One pod, no Service | Containers of a pod share the network, so a NetworkPolicy cannot force the sandbox through the proxy |
| A Kubernetes client library (`@kubernetes/client-node`) | Typed calls | A large dependency for calls `kubectl` makes as the user would; `kubectl exec` and `cp` stream already |
| Snapshot as an image (kaniko, a registry) | All files, like `docker commit` | A registry and a builder in the cluster |
| Snapshot of `/workspace` in a PersistentVolumeClaim | Any cluster with a default StorageClass | Only `/workspace`; the claim is `ReadWriteOnce`, so sandboxes from one snapshot share a node |

## Prior art

- kubernetes-sigs/agent-sandbox (Apache-2.0, SIG Apps, active, v1.0.8 from October 2026, `v1beta1` APIs):
  `Sandbox`, `SandboxTemplate`, `SandboxClaim` and `SandboxWarmPool`, gVisor or Kata through the template's
  `runtimeClassName`. Adopted as the Kubernetes runtime. Its Python and Go SDKs talk to its router; the adapter needs
  only the resources, so it uses neither.
- iron-proxy (Apache-2.0, ironsh, active, 0.54.0): already the egress proxy (ADR 0054). Its `env` and `vault_kv`
  sources are adopted for the new providers.
- OpenBao (MPL-2.0, Linux Foundation, active): the secret store of the Kubernetes install (docs/architecture/stack.md).
  Its KV v2 API is Vault's, which iron-proxy's `vault_kv` source speaks. The tests use a fake of that API.
- kind (Apache-2.0, Kubernetes SIG Testing, active, v0.30.0): adopted for conformance in CI; kindnet enforces
  NetworkPolicies.
- kubectl (Apache-2.0): adopted as the client, as the Docker CLI is for the docker adapter.
  `@kubernetes/client-node` (Apache-2.0, active) was checked and left out (see the options).
- External Secrets Operator (Apache-2.0, active): syncs secret stores into Kubernetes Secrets. Not adopted: a
  Kubernetes Secret is readable by anyone who may read the namespace, and the value would still reach the proxy only.
  The adapter's own Secrets hold only what the proxy needs for one sandbox.

## Consequences

- foreman runs the same sandbox spec on Docker and on Kubernetes; only `template` differs.
- Shared egress behavior changes in one place, and both adapters run the same conformance scenarios.
- A Kubernetes sandbox's secrets sit in a Kubernetes Secret that only its egress pod mounts. Whoever may read Secrets
  in the namespace may read them; give sandboxes a namespace of their own.
- The kubernetes conformance runs only where kind runs: in CI, and on a developer's machine with Docker.
- Revisit when agent-sandbox gets snapshots of its own, or a claim that needs no warm pool.
