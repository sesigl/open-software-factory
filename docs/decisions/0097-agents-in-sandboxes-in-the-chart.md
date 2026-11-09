---
status: accepted
date: 2026-11-09
---

# 0097. Agents in sandboxes in the Helm chart

## Context

The Compose profile runs every stage of the reference factory in a sandbox of the docker sandbox adapter (ADR 0096).
The chart shares the reference factory, but its foreman had no Docker, so each stage that declares a sandbox failed.
The kubernetes sandbox adapter exists (ADR 0055). For each sandbox, it applies a SandboxClaim, a SandboxTemplate and a
SandboxWarmPool of agent-sandbox, an egress pod with its Service, ConfigMaps, and a Secret with the real values of
the sandbox's secrets. So whoever runs the adapter may create and read Secrets in the sandboxes' namespace. ADR 0055
advises a namespace of its own for the sandboxes.

## Decision

- **The adapter.** The chart's foreman runs `FOREMAN_SANDBOX: kubernetes` with `sandbox-kubernetes`. The foreman
  image adds kubectl from `registry.k8s.io/kubectl`, which uses the pod's ServiceAccount inside the cluster.
- **A namespace of their own.** The sandboxes run in `<release namespace>-sandboxes`, or in `sandboxes.namespace`. The
  chart creates it, unless `sandboxes.createNamespace` is `false`.
- **Only the adapter's rights, only there.** foreman's ServiceAccount has a Role in the sandboxes' namespace with only
  the kinds and verbs that the adapter uses. In the release namespace, it has no rights, so it cannot read the chart
  Secret.
- **The gateway by the same name.** In the sandboxes' namespace, an ExternalName Service `litellm` points to the
  chart's LiteLLM. A sandbox whose `egress` allows `litellm` reaches it, as in the Compose profile, so the reference
  factory stays the same.
- **The agents' tokens.** The chart Secret has the optional keys `github-token` and `claude-code-oauth-token`.
  foreman gets them as `OSF_SECRET_GH_TOKEN` and `OSF_SECRET_CLAUDE_CODE_OAUTH_TOKEN`, and the adapter gives them only
  to each sandbox's egress pod.
- **agent-sandbox is a prerequisite**, which the operator installs, as with a network plugin that enforces
  NetworkPolicies. The chart does not install it.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Sandboxes in a namespace of their own | foreman can read no Secret of the release, as ADR 0055 advises | The chart creates a namespace, so the installer needs that right, or the operator creates it |
| Sandboxes in the release namespace | No namespace to create; `litellm` resolves directly | foreman could read every Secret of the release, with the PostgreSQL password and the Slack tokens |
| The FQDN of LiteLLM in the chart's factory | No extra Service | The chart's reference factory would differ from the profile's |
| The chart installs agent-sandbox | One command for everything | agent-sandbox has CRDs and a controller for the whole cluster; a platform team installs those once |

## Prior art

No new dependency. agent-sandbox (Apache-2.0, kubernetes-sigs, released monthly) and the kubernetes sandbox adapter
are in ADR 0055. The kubectl image is the official one of the Kubernetes project, at the version that `make install`
pins.

## Consequences

The profile and the chart run the same reference factory with sandboxes. A cluster without agent-sandbox installs the
chart, but its stages fail when they start their sandboxes. The Service `litellm` still allows only one release per
namespace. Revisit when agent-sandbox has a Helm chart that the chart can depend on, or when the sandboxes need a
gateway other than LiteLLM.
