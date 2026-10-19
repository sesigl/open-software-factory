---
status: accepted
date: 2026-10-19
---

# 0022. factory-spec registers forge webhooks and renders kagent and gh-aw files

## Context

ADR 0020 left three parts of T-03 for a second pull request. Automations such as
`forgejo.issue.labeled(auto-implement)` only start work when the forge sends its events to intake, so someone has
to register a webhook and notice when a person changes it (internals.md: "`factory apply` registers webhooks").
The architecture names two more ways to run a factory: a Kubernetes operator mode, where `factory render --k8s`
writes kagent resources for Argo CD or Flux, and GitHub Agentic Workflows (gh-aw) for teams that run agents in
GitHub Actions.

## Decision

- **Forge webhooks.** For every automation `forgejo.<object>[.<action>][(<argument>)]`, `factory apply` makes
  each repository the agents operate on (`agents.<name>.repositories`, as `<owner>/<name>`) hold one webhook to
  `FACTORY_INTAKE_URL` for the needed events (`issue.labeled` is `issue_label`, `issue` is `issues`,
  `pull_request.labeled` is `pull_request_label`; any other object is its own event name). The forge is
  `FACTORY_FORGE_URL` with the token `FACTORY_FORGE_TOKEN`, through the Forgejo API v1. The applied webhook ids
  are recorded in the state. Apply updates a recorded webhook, recreates a deleted one and removes the webhook of
  a repository the factory no longer needs. `factory plan` reads each recorded webhook and prints a changed URL,
  event list or active flag as `! webhook <repository>.<field>: <old> -> <new>`, and a deleted webhook as
  `! webhook <repository> was deleted outside "factory apply"`. The argument of the filter (the label) is not a
  webhook setting; intake filters on it.
- An update always sends the URL, the events and the active flag together: Forgejo resets the events to `push`
  when a PATCH carries only the configuration.
- **`render --k8s`** writes `k8s/<agent>.yaml` with a kagent `ModelConfig` (`kagent.dev/v1alpha2`, provider
  `OpenAI`, base URL `FACTORY_INFERENCE_URL`, default `http://litellm:4000/v1`, key from the secret
  `<factory>-inference`), one `MCPServer` (`kagent.dev/v1alpha1`, stdio, `npx -y <package>`) or `RemoteMCPServer`
  (`kagent.dev/v1alpha2`, streamable HTTP) per MCP server, and a declarative `Agent` (`kagent.dev/v1alpha2`)
  with the prompt as system message and those servers as tools. The model stays a routing alias of the gateway.
- **`render --gh-aw`** writes `.github/workflows/<name>.md` for every automation GitHub starts: a
  `github.<object>.<action>(<labels>)` event becomes `on: <event>: {types, names}` (`issue` is `issues`), and a
  cron automation becomes `on: schedule` named after its `run` job. The frontmatter names the engine (`claude`
  for claude-code, `codex` for codex) and the agent's MCP servers with all tools allowed; the body is the prompt.
  gh-aw compiles these files into Actions workflows. A harness without a gh-aw engine is an error.
- **Release.** factory-spec is published to npm like the testkit: release-please with the tag
  `factory-spec-v<version>`, first version `0.1.0`, and `.github/workflows/publish-factory-spec.yml`.
- **Not in this change.** agent-sandbox `SandboxTemplate` resources need the sandbox port and its templates
  (T-13). GitHub webhooks and GitLab follow with the forge port (T-15); a GitHub automation runs through gh-aw.
  ACP Registry pins wait for the harness port (T-12).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Webhooks through the Forgejo API, ids in the state | Drift by id, also when a person edits the URL; no extra service | One adapter per forge |
| Find the webhook by its URL on every run | No state | A changed URL looks like a missing webhook, so drift of the URL cannot be shown |
| Terraform's Gitea provider for webhooks | Mature plan and drift | A second tool and state beside `factory apply` |
| kagent resources for operator mode | The architecture's choice; Kubernetes-native, MCP servers as resources | kagent's API is still `v1alpha` |
| gh-aw Markdown workflows | GitHub compiles and runs them; frontmatter names engine and MCP servers | Only the engines gh-aw supports |

## Prior art

- Forgejo API v1 (GPL-3.0 server, active): hooks endpoints `POST/GET/PATCH/DELETE /repos/{owner}/{repo}/hooks`.
  Checked against Forgejo 11.0.6, the image the testkit's forge fake runs (ADR 0016).
- Terraform provider for Gitea (MIT, active): manages repository webhooks with drift. Not adopted, see above.
- kagent (Apache-2.0, CNCF sandbox, active): the CRDs `Agent`, `ModelConfig`, `RemoteMCPServer` (`v1alpha2`) and
  `MCPServer` (`v1alpha1`, from kmcp). Shapes taken from its documentation and CRDs.
- gh-aw, GitHub Agentic Workflows (MIT, active): Markdown with `on`, `engine` and `mcp-servers` frontmatter.
- kubernetes-sigs/agent-sandbox (Apache-2.0, active): `SandboxTemplate`; deferred to T-13.
- No new dependency: `yaml` (ADR 0020) writes the manifests and the frontmatter; Node's `fetch` calls Forgejo.

## Consequences

- One `factory apply` keeps the forge in step with `factory.yaml`, and a nightly `factory plan` shows a webhook
  someone changed by hand.
- `factory plan` and `factory apply` need the forge variables only when the factory has forgejo automations or
  the state records webhooks.
- The kagent and gh-aw files are rendered, not applied: Argo CD, Flux or GitHub apply them.
- Revisit the kagent API versions when kagent releases `v1`, and the webhook secret when intake verifies
  signatures.
