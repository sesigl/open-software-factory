---
covers: [modules/factory-spec/src/**]
---

# factory-spec

One `factory.yaml` rendered for every harness. Claude Code, Codex and OpenCode read the same prompt, skills and MCP
servers, and `factory plan` shows what a change does before `factory apply` writes it. It also registers the forge
webhooks of automations and writes kagent and gh-aw files. Decisions:
[ADR 0020](../../docs/decisions/0020-factory-spec.md) and [ADR 0022](../../docs/decisions/0022-factory-spec-automations-and-targets.md). The format is the `factory-definition` contract
([`contracts/`](../../contracts/README.md)).

## Quick start

This quick start is scenario `SCN-FSPEC-001` and is tested on every change. Save a factory with one agent:

```yaml factory.yaml
version: 1
factory: hello
providers:
  harness:
    claude-code: "^2"
agents:
  assistant:
    harness: claude-code
    model: routes/default
    prompt: ./agents/assistant.md
    mcp:
      - "@modelcontextprotocol/server-filesystem@2025.8.21"
```

```markdown agents/assistant.md
# Assistant

You help the team of the hello factory. Read files with the filesystem server before you answer.
```

Then render it:

```sh
npx @opensoftware/factory-spec render
```

It writes `$OUTPUT/AGENTS.md` from the prompt, `CLAUDE.md` that imports it, and `.mcp.json` that starts the
filesystem server with `npx`.

## What it writes

| Harness | Files below `$OUTPUT` |
| --- | --- |
| every harness | `AGENTS.md`, a copy of the agent's prompt |
| `claude-code` | `CLAUDE.md` (`@AGENTS.md`), `.mcp.json`, one link per skill in `.claude/skills/` |
| `codex` | `.codex/config.toml` (`[mcp_servers.<name>]`), one link per skill in `.agents/skills/` |
| `opencode` | `opencode.json` (`mcp`), one link per skill in `.opencode/skills/` |

`render` writes the agent's own harness; `--harness all` writes every harness under `providers.harness`. A link in
a skill folder whose skill the factory no longer declares is removed. The model is not written: the inference
gateway routes it at run time.

## MCP servers and factory.lock

- `<package>@<version>`, for example `@modelcontextprotocol/server-filesystem@2025.8.21`: an npm package that the
  harness starts with `npx -y` over stdio. Its key is the last part of the name, `server-filesystem`.
- `registry:<name>@<range>`, for example `registry:io.github.acme/tracker@1.4`: a server in the
  [MCP Registry](https://registry.modelcontextprotocol.io). `factory plan` picks the highest version in the range
  once and pins it, with its npm package or remote URL, in `factory.lock` next to `factory.yaml`. Commit the lock.
  `render`, `apply` and later plans read only the lock; a registry server without an entry fails with
  `run "factory plan"`.

## Plan, apply and drift

`factory apply` renders like `render` and records the applied definition, the prompt hashes and the hash of every
written file in the state folder `OSF_DATA`. `factory plan` compares with that record:

```text
~ agents.triage.model: "routes/triage" -> "routes/fast"
! AGENTS.md changed outside "factory apply"

Plan: 0 to add, 1 to change, 0 to remove, 1 drifted.
```

`+` is a new value, `-` a removed one, `~` a changed one, `!` a rendered file changed by hand. Rolling back is
applying an older version: check out the older `factory.yaml` and run `factory apply`. `factory diff` compares two
versions without the state, for example `factory diff HEAD~1:factory.yaml`.

As a library, `resolveFactory(file)` returns the resolved definition that `factory resolve` prints:

```ts
import { resolveFactory } from "@opensoftware/factory-spec";

const definition = resolveFactory("factory.yaml"); // a FactoryDefinition with defaults and pinned MCP versions
```

## Forge webhooks

An automation `forgejo.<object>.<action>(...)` needs the forge to send its events to intake. `factory apply`
registers one webhook on every repository the agents operate on (`repositories: [<owner>/<name>]`) and records it
in the state:

```yaml
agents:
  triage:
    repositories: [acme/web]
    # ...
automations:
  - on: forgejo.issue.labeled(auto-implement)
```

Set `FACTORY_FORGE_URL`, `FACTORY_FORGE_TOKEN` (a Forgejo token that may write repositories) and
`FACTORY_INTAKE_URL`. Apply updates a webhook someone changed, recreates a deleted one and removes the webhook when
the factory drops the automation. `factory plan` reports both as drift:

```text
! webhook acme/web.url: "https://intake.acme.example/webhooks/forge" -> "http://elsewhere.example/hook"
! webhook acme/web was deleted outside "factory apply"
```

`issue.labeled` registers the event `issue_label`, `issue` registers `issues`, `pull_request.labeled` registers
`pull_request_label`. The label in parentheses is not a webhook setting: intake filters on it.

## Kubernetes: render --k8s

`factory render --k8s` also writes `k8s/<agent>.yaml` for [kagent](https://kagent.dev): a `ModelConfig` that sends
the agent's model alias to the inference gateway at `FACTORY_INFERENCE_URL` (the key comes from the secret
`<factory>-inference`, key `OPENAI_API_KEY`), one `MCPServer` (`npx -y <package>`) or `RemoteMCPServer` per MCP
server, and an `Agent` with the prompt as system message and those servers as tools. An agent with `sandbox` also
gets an [agent-sandbox](https://github.com/kubernetes-sigs/agent-sandbox) `SandboxTemplate` named after the agent:
one container `sandbox` with the image `sandbox.template` and the CPU and memory as requests and limits. The
kubernetes sandbox adapter starts the agent's sandboxes from it
([ADR 0055](../../docs/decisions/0055-sandbox-kubernetes.md)). Argo CD or Flux applies the folder.

## GitHub: render --gh-aw

`factory render --gh-aw` also writes one [gh-aw](https://github.com/github/gh-aw) workflow per automation GitHub
starts, below `.github/workflows/`:

| Automation | File | Runs on |
| --- | --- | --- |
| `on: github.issue.labeled(auto-implement)` | `issue-labeled-auto-implement.md` | `issues`, type `labeled`, label `auto-implement` |
| `cron: "0 10 * * *"`, `run: self-triage-report` | `self-triage-report.md` | `schedule`, `0 10 * * *` |

The frontmatter names the engine (`claude` for claude-code, `codex` for codex) and the agent's MCP servers; the
body is the prompt. `gh aw compile` turns the files into Actions workflows.

## Releases

release-please opens a release pull request from the Conventional Commits under `modules/factory-spec/`. Merging
it creates the tag `factory-spec-v<version>`, and `.github/workflows/publish-factory-spec.yml` builds `dist/` and
publishes `@opensoftware/factory-spec` to npm. The first release is `0.1.0`; until `1.0.0`, a breaking change raises
the minor version. The one-time setup is the same as for contracts
([`contracts/README.md`](../../contracts/README.md#releases)), with a trusted publisher for
`publish-factory-spec.yml`. No credential is stored in the repository.

## Commands

<!-- generated by make docs from src/cli.ts --help: do not edit -->

| Command | What it does |
| --- | --- |
| `factory lint` | Check factory.yaml; print each problem with its file, line and column. |
| `factory render [--agent <name>] [--harness <name>] [--k8s] [--gh-aw]` | Write AGENTS.md, the MCP servers and the skill links of one agent to $OUTPUT. --harness all writes every declared harness; --k8s adds its kagent resources and SandboxTemplate; --gh-aw adds a gh-aw workflow per GitHub automation. |
| `factory plan` | Pin registry MCP servers in factory.lock; show what apply changes and what drifted, rendered files and webhooks. |
| `factory apply [--agent <name>] [--harness <name>] [--k8s] [--gh-aw]` | Render like render, register the webhooks of forgejo automations, and record what was applied in OSF_DATA. |
| `factory diff <old> [<new>]` | Show the changes between two versions of factory.yaml, as files or Git revisions. |
| `factory resolve` | Print the resolved definition as JSON: defaults filled in, registry servers pinned. |

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `OUTPUT` | string | `"."` | Folder that render and apply write the harness files to. |
| `OSF_DATA` | string | `".factory"` | State folder: apply records the applied version here and plan compares with it. |
| `FACTORY_MCP_REGISTRY` | string | `"https://registry.modelcontextprotocol.io"` | Base URL of the MCP Registry that plan reads to pin registry servers in factory.lock. |
| `FACTORY_FORGE_URL` | string |  | Base URL of the Forgejo forge that holds the webhooks of forgejo automations, for example https://code.example.org. |
| `FACTORY_FORGE_TOKEN` | string |  | Forgejo API token that may manage the webhooks of the agents' repositories. |
| `FACTORY_INTAKE_URL` | string |  | The address that receives the webhooks of forgejo automations, usually intake. |
| `FACTORY_INFERENCE_URL` | string | `"http://litellm:4000/v1"` | Base URL of the OpenAI-compatible inference gateway that the kagent ModelConfig of render --k8s points at. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-FSPEC-001 | implemented | A new user renders the sample factory from the README |
| SCN-FSPEC-002 | implemented | Lint accepts a factory without problems |
| SCN-FSPEC-003 | implemented | Lint names the line of a secret whose provider is not declared |
| SCN-FSPEC-004 | implemented | Lint names the line of a field the format does not know |
| SCN-FSPEC-005 | implemented | Lint names the line of YAML that does not parse |
| SCN-FSPEC-006 | implemented | Lint reports an agent whose harness is not declared |
| SCN-FSPEC-007 | implemented | Lint reports a referenced file that does not exist |
| SCN-FSPEC-008 | implemented | Lint reports a stage whose agent is not declared |
| SCN-FSPEC-009 | implemented | Render refuses a factory with problems |
| SCN-FSPEC-010 | implemented | Render for Codex writes config.toml with the declared MCP servers |
| SCN-FSPEC-011 | implemented | Render for every harness links each skill into the skill folder of each harness |
| SCN-FSPEC-012 | implemented | Render removes the link of a skill the factory no longer declares |
| SCN-FSPEC-013 | implemented | Render asks for the agent when the factory has several |
| SCN-FSPEC-014 | implemented | Render renders the agent named with --agent |
| SCN-FSPEC-015 | implemented | Render refuses a harness it cannot write |
| SCN-FSPEC-016 | implemented | Plan pins an MCP server from the registry to an exact version in factory.lock |
| SCN-FSPEC-017 | implemented | Plan uses the version factory.lock pins without calling the registry |
| SCN-FSPEC-018 | implemented | Render starts a registry server with the package version factory.lock pins |
| SCN-FSPEC-019 | implemented | Render connects to a registry server by the remote URL factory.lock pins |
| SCN-FSPEC-020 | implemented | Render asks for a plan when factory.lock has no entry for a registry server |
| SCN-FSPEC-021 | implemented | Plan reports a range that no registry version matches |
| SCN-FSPEC-022 | implemented | Plan of a factory that was never applied shows the factory as added |
| SCN-FSPEC-023 | implemented | Apply renders the files and prints the digest of what it applied |
| SCN-FSPEC-024 | implemented | Plan after apply shows no changes |
| SCN-FSPEC-025 | implemented | Plan shows a model change as one diff line |
| SCN-FSPEC-026 | implemented | Plan shows a changed prompt |
| SCN-FSPEC-027 | implemented | Plan reports a rendered file changed by hand as drift |
| SCN-FSPEC-028 | implemented | Applying an older version rolls the rendered files back |
| SCN-FSPEC-029 | implemented | Diff shows the changes between a Git revision and the working copy |
| SCN-FSPEC-030 | implemented | Diff of two equal versions shows no changes |
| SCN-FSPEC-031 | implemented | Resolve prints the definition with defaults and pins |
| SCN-FSPEC-032 | implemented | The help lists every command |
| SCN-FSPEC-033 | implemented | Apply registers a webhook on the repository of an automation |
| SCN-FSPEC-034 | implemented | Plan reports a webhook changed on the forge as drift |
| SCN-FSPEC-035 | implemented | Apply restores a webhook changed on the forge |
| SCN-FSPEC-036 | implemented | Plan reports a webhook deleted on the forge as drift |
| SCN-FSPEC-037 | implemented | Apply recreates a webhook deleted on the forge |
| SCN-FSPEC-038 | implemented | Apply removes the webhook when the factory drops the automation |
| SCN-FSPEC-039 | implemented | Apply asks for the forge when an automation needs a webhook |
| SCN-FSPEC-040 | implemented | Render for Kubernetes writes a kagent Agent and its ModelConfig |
| SCN-FSPEC-041 | implemented | Render for Kubernetes runs each npm MCP server as an MCPServer the Agent uses |
| SCN-FSPEC-042 | implemented | Render for Kubernetes connects a remote registry server as a RemoteMCPServer |
| SCN-FSPEC-043 | implemented | Render for gh-aw writes a workflow for issues that get a label |
| SCN-FSPEC-044 | implemented | Render for gh-aw writes a scheduled workflow for a cron automation |
| SCN-FSPEC-045 | implemented | Render for gh-aw gives the workflow the agent's MCP servers |
| SCN-FSPEC-046 | implemented | Render for gh-aw refuses a harness gh-aw cannot run |
| SCN-FSPEC-047 | implemented | Apply shows the forge's answer when it refuses the token |
| SCN-FSPEC-048 | implemented | Render for Kubernetes writes an agent-sandbox SandboxTemplate for the agent's sandbox |
