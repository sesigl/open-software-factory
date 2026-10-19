---
status: accepted
date: 2026-10-19
---

# 0022. factory-spec registers forge webhooks and renders Kubernetes and gh-aw files

## Context

ADR 0020 left three parts of T-03 for a second pull request. `factory apply` must register the webhooks that start
the factory's automations and report a webhook changed by hand as drift (internals.md, "Plan, apply, drift").
Platform teams run the factory on Kubernetes: `factory render --k8s` writes kagent resources and agent-sandbox
templates that Argo CD or Flux applies. Teams that only use GitHub run their automations as GitHub Agentic
Workflows (gh-aw), which factory-spec renders (components.md). The module also gets its first release.

The forge port and its adapters come with T-15. The `factory-definition` contract already has `automations` with
`on` and `cron`, `agents.*.repositories` and `agents.*.sandbox`; this change needs no contract change.

## Decision

- **Webhooks.** An automation whose `on` filter starts with `forgejo.`, for example
  `forgejo.issue.labeled(auto-implement)`, needs a webhook. `factory apply` makes every repository under
  `agents.*.repositories` carry exactly one webhook of the factory: target `FACTORY_INTAKE_URL`, the Forgejo
  events of all such automations, active, JSON. It updates the webhook with that URL when one exists, creates it
  otherwise, and deletes it from a repository the factory no longer covers. The forge is reached at
  `FACTORY_FORGE_URL` with `FACTORY_FORGE_TOKEN`; `FACTORY_WEBHOOK_SECRET`, when set, signs the deliveries. The
  token and the secret are never written to the state or to any file.
- The filter maps to Forgejo events by a fixed table: `issue.labeled` and `issue.unlabeled` to `issue_label`,
  other `issue.*` to `issues`, `issue.commented` to `issue_comment`, `pull_request.labeled` to
  `pull_request_label`, other `pull_request.*` to `pull_request`, `push` to `push`, `release.*` to `release`. A
  filter outside the table fails apply with its text.
- Apply records each webhook as the forge returns it (ID, URL, events, active) in the state. `factory plan`
  reads the webhook again and prints `! webhook of <repository> changed outside "factory apply"` or
  `! webhook of <repository> was deleted outside "factory apply"`; both count as drifted.
- The webhook code is a small Forgejo client in the module's `adapters` layer. It moves behind the forge port
  when T-15 exists. GitHub repositories get no webhook from factory-spec: their automations run as gh-aw
  workflows.
- **Kubernetes.** `factory render --k8s` writes, for every agent, one file per resource below `$OUTPUT/k8s/`:
  a kagent `Agent` (`kagent.dev/v1alpha2`, `Declarative`, the prompt as system message), a `ModelConfig`
  (`kagent.dev/v1alpha2`, provider `OpenAI`, the agent's model, base URL `FACTORY_INFERENCE_URL`, the inference
  gateway), an `MCPServer` (`kagent.dev/v1alpha1`, `npx -y <package>` over stdio) or a `RemoteMCPServer`
  (`kagent.dev/v1alpha2`, the URL the lock pins) per MCP server, and an agent-sandbox `SandboxTemplate`
  (`extensions.agents.x-k8s.io/v1alpha1`) for an agent with `sandbox`. The template's image is
  `<FACTORY_SANDBOX_IMAGES>/<sandbox.template>`; CPU and memory become requests and limits; the egress hosts
  become the annotation `opensoftware.dev/egress`, which the egress proxy of T-13 reads. Every resource carries
  the labels `app.kubernetes.io/part-of: <factory>` and `app.kubernetes.io/managed-by: factory-spec`.
- **gh-aw.** `factory render --gh-aw` writes one workflow `.github/workflows/<name>.md` per automation whose
  filter starts with `github.` or that has a `cron`. The front matter holds `on` (`issues`, `pull_request`,
  `issue_comment`, `push` or `release` with `types` from the action and `names` from a label argument; or
  `schedule`), `engine` (`claude` for `claude-code`, `codex` for `codex`; other harnesses fail) and
  `mcp-servers`; the body is the agent's prompt. The name is `run`, or the filter without its source, for example
  `issue-labeled-auto-implement`. The agent is the one `run` names, else the agent of the first workflow stage,
  else the first agent. `gh aw compile` turns the file into its lock file; factory-spec does not compile.
- `factory apply` accepts `--k8s` and `--gh-aw` like render, so plan reports those files as drift too.
- **Release.** `@opensoftware/factory-spec` is published like the testkit: release-please with the component
  `factory-spec`, first version `0.1.0`, minor bumps before `1.0.0`, and `.github/workflows/publish-factory-spec.yml`
  publishing `dist/` after the release.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Register webhooks from factory-spec now | T-03 asks for it; drift needs it | A Forgejo client that later moves behind the forge port |
| Wait for the forge port (T-15) | One client for every module | T-03 stays open; plan cannot see webhook drift |
| Webhooks also on GitHub | One mechanism | gh-aw already runs GitHub automations without an intake |
| One multi-document Kubernetes file | One file to apply | Diffs and drift are per resource; Argo CD and Flux read folders |
| Compile gh-aw workflows ourselves | One step less | Duplicates gh-aw's compiler and its security checks |

## Prior art

- kagent (Apache-2.0, CNCF sandbox, active): its `Agent`, `ModelConfig` and `RemoteMCPServer` CRDs
  (`kagent.dev/v1alpha2`) and kmcp's `MCPServer` (`kagent.dev/v1alpha1`) are the render target. Adopted as the
  Kubernetes runtime; factory-spec only writes its resources.
- agent-sandbox (`kubernetes-sigs/agent-sandbox`, Apache-2.0, active, `v1alpha1`): `SandboxTemplate` in the
  extensions group is the render target for an agent's sandbox.
- gh-aw (GitHub Agentic Workflows, MIT, active): Markdown workflows with front matter (`on`, `engine`,
  `mcp-servers`) compiled to Actions by `gh aw compile`. Adopted as the GitHub runtime; factory-spec writes the
  Markdown.
- Forgejo (GPL-3.0, active): its repository webhook API (`/repos/{owner}/{repo}/hooks`) is the target. The
  official SDKs are Go only; a few `fetch` calls are smaller than a generated client.
- Terraform's `gitea_repository_webhook` and `github_repository_webhook` resources (MPL-2.0): the model for
  owning a webhook by its URL and reporting changes as drift.
- No new npm dependency: `yaml` (ADR 0020) writes the Kubernetes and gh-aw files.

## Consequences

- One `factory.yaml` now reaches a laptop (harness files), a cluster (kagent) and GitHub Actions (gh-aw).
- The factory owns one webhook per repository by its URL. A person can still add other webhooks; plan ignores
  them.
- The CRD versions are alpha. Revisit the rendered fields when kagent or agent-sandbox reach beta, and move the
  Forgejo client behind the forge port in T-15.
