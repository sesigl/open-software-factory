---
covers: [modules/factory-spec/src/**]
---

# factory-spec

One `factory.yaml` rendered for every harness. Claude Code, Codex and OpenCode read the same prompt, skills and MCP
servers, and `factory plan` shows what a change does before `factory apply` writes it. It also registers the forge
webhooks of automations, writes kagent and gh-aw files, and `factory edit` changes `factory.yaml` for a program such as
the console. Decisions:
[ADR 0020](../../docs/decisions/0020-factory-spec.md), [ADR 0022](../../docs/decisions/0022-factory-spec-automations-and-targets.md), [ADR 0060](../../docs/decisions/0060-factory-spec-forge-port.md), [ADR 0078](../../docs/decisions/0078-agent-effort.md), [ADR 0107](../../docs/decisions/0107-a-stage-that-only-waits.md), [ADR 0135](../../docs/decisions/0135-one-job-and-a-listed-surface.md), [ADR 0140](../../docs/decisions/0140-skills-in-the-agent-skills-format.md) and [ADR 0146](../../docs/decisions/0146-skills-of-other-repositories-pinned-in-factory-lock.md). The format is the `factory-definition` contract
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
    effort: medium
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
| `claude-code` | `CLAUDE.md` (`@AGENTS.md`), `.mcp.json`, one link per skill in `.claude/skills/`; with a stop check, the `Stop` hook in `.claude/settings.json` |
| `codex` | `.codex/config.toml` (`[mcp_servers.<name>]`), one link per skill in `.agents/skills/` |
| `opencode` | `opencode.json` (`mcp`), one link per skill in `.opencode/skills/` |

`render` writes the agent's own harness; `--harness all` writes every harness under `providers.harness`. A link in
a skill folder whose skill the factory no longer declares is removed. The model and the effort are not written:
the inference gateway routes the model at run time, and the foreman hands each stage's agent its effort.

### Stop check

An agent may name a command its harness runs before the agent ends a turn in which it changed files (ADR 0168):

```yaml
agents:
  implement:
    stopCheck:
      command: make check-fast
```

When the command fails, the agent gets its output once and goes on; a turn that changed nothing, or one that the
check already sent back, ends as it would without it, so an agent that cannot fix the check can stop and ask.
`render` writes it for Claude Code as the one `Stop` hook of `.claude/settings.json` (code 2 with the check's output
when it fails). It reads the file first and keeps every other key and hook a person wrote there; without a stop check
it leaves the file alone. Codex and opencode run no stop check: `render` writes nothing for them and prints
`codex runs no stop check, so factory render writes none for it`. `factory lint` refuses a blank command, and
`factory plan` reports a Stop hook changed by hand as drift.

## Model and effort

Every agent names its `model` and its `effort`: `low`, `medium`, `high`, `xhigh` or `max`, how much the model thinks
before it answers (ADR 0078). Both are required, so the file shows what each agent runs at. Each harness adapter maps
`effort` to its product's own setting. The rule for the levels:

- A smart model (Opus, Sonnet) works at `low` or `medium`. It is strong enough for most work.
- Only an agent for hard work gets `high` or more on a smart model, with a comment that says why.
- A small model (Haiku) works at `high` or more.

`factory lint` does not check the rule: a model can be a routing alias like `routes/implement`, which hides its
family. The review of the factory's pull request does.

## Stages

Each stage of `workflow` runs an agent, the one with the stage's name unless it names `agent`. A stage with
`wait: true` runs none ([ADR 0107](../../docs/decisions/0107-a-stage-that-only-waits.md)): the foreman waits for its
`checks`, its `evidence: required` and its `gate`, and then goes on without a model call. `factory lint` reports such a
stage when it names an `agent` (`stage "verify" only waits, so it names no agent`) or waits for nothing
(`stage "verify" only waits, so it names checks, the evidence "required" or a gate`). `factory resolve` gives it no
agent.

A stage with checks may name `rework: <stage>`, an earlier stage whose agent runs once more, with the failed checks in
its prompt, when a check of the stage fails; when they fail again, the run fails
([ADR 0165](../../docs/decisions/0165-a-failed-check-sends-the-run-back-once.md)). `factory lint` reports a `rework`
that names no stage before it (`stage "verify" sends a failed check back to "ship", which is no stage before it`) or a
stage that only waits (`stage "ship" sends a failed check back to "verify", which only waits`), and one on a stage
that waits for no check, neither `checks` nor `evidence: required`
(`stage "implement" sends a failed check back, but it waits for no check`).

## Warnings

`factory lint` also warns about the fields that take no effect in a run (T-44). A warning is no problem: the command
still exits with 0, and the last line counts the warnings, for example `factory.yaml: no problems, 1 warning`. Each
warning names its field as a JSON Pointer:

- `factory.yaml:13:5 warning /automations/0/cron: only a gh-aw workflow runs a cron automation, so render it with
  --gh-aw`. The foreman starts no run on a schedule; `factory render --gh-aw` writes a scheduled workflow for it.
  `factory lint --gh-aw` gives no such warning.
- `warning /scorers/<name>: no job of the profile runs a scorer yet, so it has no effect`, and the same for each of
  `benchmarks`, until the profile's jobs run them (T-31).

## Skills

A skill is a folder with a `SKILL.md` in the [Agent Skills](https://agentskills.io/specification) format, which
Claude Code, Codex and OpenCode read ([ADR 0140](../../docs/decisions/0140-skills-in-the-agent-skills-format.md)). An
agent names its skills by folder (`skills: [./skills/release-notes]`); `render` links each one into every harness's
folder, and the foreman copies its files into the run's session (ADR 0112). The front matter names the skill and says
what it does and when to use it. What the skill needs from the factory goes into `metadata`, each as one text of names
separated by spaces:

```markdown
---
name: release-notes
description: Write the release notes of a change from its Linear issues. Use when a change ships.
metadata:
  opensoftware/secrets: LINEAR_TOKEN
  opensoftware/hosts: api.linear.app
---

# Release notes

Read the Linear issues that the commits name, then ...
```

- `opensoftware/secrets` names each secret by the variable that holds it in a sandbox: the name of the agent's
  reference in upper case, every character outside `A-Z` and `0-9` as `_`. `ref:openbao/linear-token` and
  `ref:env/LINEAR_TOKEN` both give `LINEAR_TOKEN`.
- `opensoftware/hosts` names each host the skill reaches, as `sandbox.egress` names it.

`factory lint` checks every skill an agent uses. Each of these is a problem, which also stops `render`, `plan`,
`apply` and `edit`:

- The path is no folder with a `SKILL.md`, or `SKILL.md` has no front matter between its first line `---` and the
  next, or its front matter does not parse.
- `name` is missing, is not lowercase letters and digits with single hyphens between them, is longer than 64
  characters or is not the folder's name.
- `description` is missing or longer than 1024 characters; `compatibility` is longer than 500.
- `metadata` is no mapping, a need is no text, or it names a secret or a host that does not fit its form.
- A file of the folder is not UTF-8 text: the foreman copies a skill's files as text.
- Two folders of one name: `the skill "./shared/release-notes" has the name "release-notes" of the skill
  "./skills/release-notes": a factory uses one skill of a name`. One folder for several agents is one skill.
- The agent lacks a secret or, in a sandbox, a host its skill needs, named at the agent's skill entry:
  `factory.yaml:14:14 agent "triage" lacks the secret LINEAR_TOKEN that its skill "release-notes" needs: add a
  reference such as "ref:<provider>/linear-token" to agents.triage.secrets`. An agent without a sandbox reaches every
  host, so lint asks it for none.

A `SKILL.md` of 500 lines or more is a warning: the format asks for fewer, with the details in files beside it. A
problem in a skill's own file names that file, its line and its column, for example
`skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it`. Other fields,
such as `license`, `allowed-tools`, Claude Code's `disable-model-invocation` or OpenCode's
`metadata.opencode/autoinvoke`, stay as they are.

### The skills as JSON

`factory skills` prints every skill an agent uses as one JSON document, for a program that shows them, such as the
console's pages `/skills` and `/skills/<name>`. It reads the skills with the rules above, so the program never parses
a `SKILL.md` itself (ADR 0135). A skill that lint refuses is printed with its problems; only a `factory.yaml` that does
not fit the contract fails the command, with the lines of `factory lint` on stderr and exit code 1. The document is
the format `skill-catalog` of the contracts ([ADR 0143](../../docs/decisions/0143-skill-catalog-contract.md)):
`validate("skill-catalog", …)` of `@opensoftware/contracts` checks it, and its types are `SkillCatalog` and
`CatalogSkill`.

```json
{
  "skills": [
    {
      "name": "release-notes",
      "description": "Write the release notes of a change from its Linear issues. Use when a change ships.",
      "source": { "folder": "skills/release-notes" },
      "needs": { "secrets": ["LINEAR_TOKEN"], "hosts": ["api.linear.app"] },
      "agents": [
        { "name": "triage", "secrets": { "LINEAR_TOKEN": "ref:openbao/linear-token" }, "lacks": { "secrets": [], "hosts": [] } }
      ],
      "files": ["SKILL.md", "teams.md"],
      "body": "\n# Release notes\n",
      "problems": []
    }
  ]
}
```

- The skills are sorted by name, and each skill's agents by name. A second folder of the same name is left out: lint
  names it.
- `source.folder` is the skill's folder relative to the folder of `factory.yaml`.
- `agents[].secrets` gives, for each secret the skill needs, the agent's reference whose variable it is; `lacks` names
  each needed secret the agent does not declare and each needed host its sandbox does not allow.
- `description` is `null` without one. `body` is the text of `SKILL.md` below the line that ends its front matter, all
  of it without front matter, and `null` without a `SKILL.md` that is UTF-8 text.
- `problems` are the problems of the skill's own files as lint prints them, relative to the folder of `factory.yaml`,
  and a folder without a `SKILL.md`.
- A skill of another repository (below) has `source.folder`, its folder in that repository, `source.repository`, the
  repository's URL, and `source.commit`, the commit `factory.lock` pins. It is read from its folder fetched at that
  commit. Without a pin it has no commit, no files and no body, and its problem is the missing pin.

### Skills of other repositories

An agent may use a folder of another Git repository at a ref:
`git+<url>#<ref>:<path>` ([ADR 0146](../../docs/decisions/0146-skills-of-other-repositories-pinned-in-factory-lock.md)).
`<ref>` is a branch, a tag or a commit, and `<path>` the skill's folder below the repository's root; the skill's name
is the last part of the path. Quote the entry in YAML.

```yaml
agents:
  triage:
    skills: ["git+https://github.com/acme/skills.git#v1.2:skills/release-notes"]
```

- `factory plan` fetches the ref and pins the commit and the hash of the skill's files in `skills.<name>` of
  `factory.lock`: `{ "source": <the entry>, "commit": <the full commit>, "hash": "h1:…" }`, the hash in the form of Go's
  `go.sum`. Commit the lock. The pin stays while the entry is unchanged, so a branch does not move it: change the ref
  (for example `v1.2` to `v1.3`) to move it. `plan` prints each new and each moved pin first, a move with both commits:
  `~ factory.lock.skills.release-notes.commit: "<old commit>" -> "<new commit>"`.
- Before it writes the lock, `plan` checks every fetched skill with the rules above, also the secrets and hosts its
  agent must declare. A problem stops `plan`, writes no lock, and names the skill's file by its entry:
  `git+https://github.com/acme/skills.git#v1.2:skills/release-notes/SKILL.md:2:1 the skill has no description: …`.
- `render` links the skill's folder fetched at its pin, and `skills` reads it there. Both, and the foreman, fetch only
  the pinned commit and refuse files whose hash is not the pin's. Without a pin they fail with
  `factory.lock has no pin of the skill "release-notes" for "<entry>": run "factory plan"`.
- `lint` reads no network. It refuses an entry that starts with `git+` and has no ref or folder, or a folder outside its
  repository (`..`), and a second skill of one name, also one local and one of another repository. An entry that the
  lock does not pin is a warning; `plan --check` names it and exits with 1.
- The fetched skills are kept in `skills/` of the state folder `OSF_DATA`, one folder per repository and commit, so a
  pinned commit is fetched once. A private repository needs Git's own credentials, such as a credential helper or an
  SSH key; no token is sent.

## MCP servers and factory.lock

- `<package>@<version>`, for example `@modelcontextprotocol/server-filesystem@2025.8.21`: an npm package that the
  harness starts with `npx -y` over stdio. Its key is the last part of the name, `server-filesystem`.
- `registry:<name>@<range>`, for example `registry:io.github.acme/tracker@1.4`: a server in the
  [MCP Registry](https://registry.modelcontextprotocol.io). `factory plan` picks the highest version in the range
  once and pins it, with its npm package or remote URL, in `factory.lock` next to `factory.yaml`. Commit the lock.
  `render`, `apply` and later plans read only the lock; a registry server without an entry fails with
  `run "factory plan"`.

`factory plan --adapters` also pins each adapter under `providers.harness`, `sandbox`, `forge` and `inference`: the
newest version of the npm package `@opensoftware/<port>-<name>` inside its range, from `FACTORY_NPM_REGISTRY`, in
`adapters.<port>.<name>` of the lock with the range it came from (ADR 0125). A pin stays while its range is unchanged;
after a range changes, the next `plan --adapters` pins it again. A plan without `--adapters` keeps the pins as they
are. The foreman runs an adapter that its maps do not name at the pinned version (contract `factory-lock`).

`factory plan --check` only checks that the lock is current, for a check of a pull request: it names each registry
server that the lock does not pin and, when the lock pins adapters, each adapter whose range it does not pin, and
exits with 1. It calls no registry and writes nothing. A pin that `factory.yaml` no longer uses does no harm and is
not reported.

```text
factory.lock has no pin of the forge "github" for "^1": run "factory plan --adapters"
```

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

## Edits: factory edit

`factory edit` makes one change to `factory.yaml` for a program, such as the console, that commits the result as a
pull request (T-58). It prints the edited file and leaves `factory.yaml` as it is:

```sh
factory edit add-secret spec ref:env/LINEAR_TOKEN > edited.yaml
```

| Edit | What it changes |
| --- | --- |
| `add-skill <agent> <path>`, `remove-skill <agent> <path>` | `agents.<agent>.skills` |
| `add-secret <agent> <reference>`, `remove-secret <agent> <reference>` | `agents.<agent>.secrets` |
| `add-egress <agent> <host>`, `remove-egress <agent> <host>` | `agents.<agent>.sandbox.egress` |
| `add-secrets-provider <name> <range>` | `providers.secrets.<name>` |

- **The output, not the file.** The caller decides where the text goes: the console commits it with the forge
  adapter's `commit` and leaves its copy of the factory's repository as it is, and two edits at the same time do not
  write one file. Do not redirect the output into `factory.yaml` itself: the shell empties the file before the edit
  reads it. Write another file and move it.
- **Comments, order and anchors stay.** The output writes no line folded and a flow list as `[a, b]`, as the
  reference factory does, so a list written as `[ a ]` becomes `[a]`.
- **A shared list stays shared.** An agent whose list is an alias (`secrets: *secrets`) gets its own copy before the
  edit. When the edited agent holds the anchor, the anchor moves to the next agent that used it, so the other agents
  still share one list.
- **The same edit twice changes nothing.** Adding a value the list has, or removing one it does not have, prints
  `factory.yaml` byte for byte and exits with 0. A value matches by its exact text. A secrets provider declared at
  the same range changes nothing; one declared at another range is refused.
- **A refused edit prints nothing.** It names the reason in one line on stderr and exits with 1: a usage error, an
  agent the factory does not declare, a `factory.yaml` that does not pass `factory lint`, or an edit whose result
  would not pass it, such as a secret whose provider is not declared, a skill folder that does not exist, a skill
  whose secret or host the agent lacks, or an egress host for an agent without a sandbox. To give an agent a skill
  with needs, add its secret reference and its host first, each with its own edit, then the skill.
- **A value is one string.** It is quoted, or written as a block, wherever YAML needs it, so no argument becomes
  YAML. A value that starts with `-` follows `--`, as in `factory edit add-skill triage -- -skills/x`.

## Forge webhooks

An automation `forgejo.<object>.<action>(...)` or `github.<object>.<action>(...)` needs the forge to send its events
to intake. `factory apply` registers one webhook on every repository the agents operate on
(`repositories: [<owner>/<name>]`) and records it in the state. In a run, the foreman also clones them into the
agent's folder below `repositories/<name>`
([ADR 0126](../../docs/decisions/0126-an-agents-repositories-in-its-folder.md)).

```yaml
agents:
  triage:
    repositories: [acme/web]
    # ...
automations:
  - on: forgejo.issue.labeled(auto-implement)
```

factory-spec has no forge client of its own: it runs the [forge port](../../ports/forge/README.md)'s adapter for the
forge, `npx -y @opensoftware/forge-forgejo` or `npx -y @opensoftware/forge-github` unless
`FACTORY_FORGEJO_ADAPTER` or `FACTORY_GITHUB_ADAPTER` names another command. Set `FACTORY_INTAKE_URL`,
`FACTORY_WEBHOOK_SECRET` (the forge signs every delivery with it) and, for each forge:

| Forge | Variables |
| --- | --- |
| Forgejo | `FACTORY_FORGE_URL` and `FACTORY_FORGE_TOKEN`, a token that may write the repositories |
| GitHub | `FACTORY_GITHUB_TOKEN`, a token with administration of the repositories; `FACTORY_GITHUB_URL` for GitHub Enterprise Server |

`factory apply --gh-aw` registers no GitHub webhook: GitHub starts those automations itself.

Apply updates a webhook someone changed, recreates a deleted one and removes the webhook when the factory drops the
automation. `factory plan` reports both as drift. A GitHub repository is named `github:<owner>/<name>`:

```text
! webhook acme/web.url: "https://intake.acme.example/webhooks/forge" -> "http://elsewhere.example/hook"
! webhook github:acme/web was deleted outside "factory apply"
```

factory-spec passes the automation's `<object>[.<action>]` to the adapter, which maps it to the forge's events: on
Forgejo `issue.labeled` is `issue_label` and `issue` is `issues`; on GitHub both are `issues`. The label in
parentheses is not a webhook setting: intake filters on it. When the adapter fails, apply and plan exit 1 with its
message, such as `the forge refused the token`.

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
| `factory lint [--gh-aw]` | Check factory.yaml, the skills its agents use and the access.yaml beside it; print each problem and each warning with its file, line and column. --gh-aw: the factory is rendered with gh-aw, so a cron automation runs. |
| `factory render [--agent <name>] [--harness <name>] [--k8s] [--gh-aw]` | Write AGENTS.md, the MCP servers and the skill links of one agent to $OUTPUT. --harness all writes every declared harness; --k8s adds its kagent resources and SandboxTemplate; --gh-aw adds a gh-aw workflow per GitHub automation. |
| `factory plan [--adapters] [--check]` | Pin registry MCP servers and skills of other repositories in factory.lock; show what apply changes and what drifted, rendered files and webhooks. --adapters also pins each adapter under providers to the newest npm version in its range. --check only names what factory.lock does not pin, exits with 1 then, and writes nothing. |
| `factory apply [--agent <name>] [--harness <name>] [--k8s] [--gh-aw]` | Render like render, register the webhooks of forgejo and github automations (github ones not with --gh-aw), and record what was applied in OSF_DATA. |
| `factory diff <old> [<new>]` | Show the changes between two versions of factory.yaml, as files or Git revisions. |
| `factory resolve` | Print the resolved definition as JSON: defaults filled in, registry servers pinned. |
| `factory skills` | Print every skill the agents use as JSON: its description, source, files, Markdown and needs, and per agent the secret references that give them and what it lacks. |
| `factory edit <edit> <agent> <value>` | Print factory.yaml with one edit, comments and anchors kept; the file stays as it is. <edit> is add-skill, remove-skill, add-secret, remove-secret, add-egress or remove-egress; "factory edit add-secrets-provider <name> <range>" declares a secrets provider. |

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `OUTPUT` | string | `"."` | Folder that render and apply write the harness files to. |
| `OSF_DATA` | string | `".factory"` | State folder: apply records the applied version here and plan compares with it. |
| `FACTORY_MCP_REGISTRY` | string | `"https://registry.modelcontextprotocol.io"` | Base URL of the MCP Registry that plan reads to pin registry servers in factory.lock. |
| `FACTORY_NPM_REGISTRY` | string | `"https://registry.npmjs.org"` | Base URL of the npm registry that plan --adapters reads to pin the adapters under providers in factory.lock. |
| `FACTORY_FORGE_URL` | string |  | Base URL of the Forgejo forge that holds the webhooks of forgejo automations, for example https://code.example.org. |
| `FACTORY_FORGE_TOKEN` | string |  | Forgejo API token that may manage the webhooks of the agents' repositories. |
| `FACTORY_FORGEJO_ADAPTER` | string | `"npx -y @opensoftware/forge-forgejo"` | Command line of the forge port's forgejo adapter, which manages the webhooks of forgejo automations. |
| `FACTORY_GITHUB_URL` | string | `"https://api.github.com"` | Base URL of GitHub's REST API for the webhooks of github automations; GitHub Enterprise Server is https://<host>/api/v3. |
| `FACTORY_GITHUB_TOKEN` | string |  | GitHub token that may manage the webhooks of the agents' repositories, for github automations. |
| `FACTORY_GITHUB_ADAPTER` | string | `"npx -y @opensoftware/forge-github"` | Command line of the forge port's github adapter, which manages the webhooks of github automations. |
| `FACTORY_INTAKE_URL` | string |  | The address that receives the webhooks of forgejo and github automations, usually intake. |
| `FACTORY_WEBHOOK_SECRET` | string |  | The secret that signs the deliveries of the webhooks apply registers; intake checks it. |
| `FACTORY_INFERENCE_URL` | string | `"http://litellm:4000/v1"` | Base URL of the OpenAI-compatible inference gateway that the kagent ModelConfig of render --k8s points at. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-FSPEC-001 | implemented | A new user renders the sample factory from the README |
| SCN-FSPEC-002 | implemented | Lint accepts a factory without problems |
| SCN-FSPEC-003 | deprecated | Lint names the line of a secret whose provider is not declared |
| SCN-FSPEC-004 | deprecated | Lint names the line of a field the format does not know |
| SCN-FSPEC-005 | implemented | Lint names the line of YAML that does not parse |
| SCN-FSPEC-006 | deprecated | Lint reports an agent whose harness is not declared |
| SCN-FSPEC-007 | deprecated | Lint reports a referenced file that does not exist |
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
| SCN-FSPEC-047 | deprecated | Apply shows the forge's answer when it refuses the token |
| SCN-FSPEC-048 | implemented | Render for Kubernetes writes an agent-sandbox SandboxTemplate for the agent's sandbox |
| SCN-FSPEC-049 | implemented | Apply shows the forge adapter's error when the forge refuses the token |
| SCN-FSPEC-050 | implemented | Apply registers a webhook on the GitHub repository of a github automation |
| SCN-FSPEC-051 | implemented | Plan reports a webhook changed on GitHub as drift |
| SCN-FSPEC-052 | implemented | Apply restores a webhook changed on GitHub |
| SCN-FSPEC-053 | implemented | Apply asks for the GitHub token when a github automation needs a webhook |
| SCN-FSPEC-054 | implemented | Apply with gh-aw workflows registers no GitHub webhook |
| SCN-FSPEC-055 | implemented | Apply asks for the webhook secret when an automation needs a webhook |
| SCN-FSPEC-056 | implemented | Apply names the forge adapter it cannot start |
| SCN-FSPEC-057 | implemented | Lint accepts a stage that waits for the check "verify" and asks for evidence |
| SCN-FSPEC-058 | deprecated | Lint names the line of an effort the format does not know, with the allowed levels |
| SCN-FSPEC-059 | implemented | Lint accepts a stage that only waits, without an agent of its name |
| SCN-FSPEC-060 | implemented | Lint reports a stage that waits and names an agent |
| SCN-FSPEC-061 | implemented | Lint reports a stage that waits for nothing |
| SCN-FSPEC-062 | implemented | Resolve gives a stage that only waits no agent |
| SCN-FSPEC-063 | implemented | Lint warns about a cron automation that only a gh-aw workflow runs |
| SCN-FSPEC-064 | implemented | Lint with --gh-aw does not warn about a cron automation |
| SCN-FSPEC-065 | implemented | Lint warns about scorers and benchmarks, which no job of the profile runs yet |
| SCN-FSPEC-066 | implemented | Plan with --adapters pins each adapter under providers to the newest npm version in its range |
| SCN-FSPEC-067 | implemented | Plan keeps an adapter's pin while its range is unchanged, and pins it again after the range changed |
| SCN-FSPEC-068 | implemented | Plan without --adapters keeps the adapter pins of factory.lock and calls no registry |
| SCN-FSPEC-069 | implemented | Plan with --adapters reports a range that no npm version matches |
| SCN-FSPEC-070 | implemented | Lint reports an access file with a role it does not know |
| SCN-FSPEC-071 | implemented | Lint reports an access file without an admin, and accepts one with an admin |
| SCN-FSPEC-072 | implemented | Lint reports an access file that is not YAML |
| SCN-FSPEC-073 | implemented | The edit of one agent keeps comments and leaves an agent that shared the list unchanged |
| SCN-FSPEC-074 | implemented | The edit of the agent that holds the anchor passes the anchor on to the agents that shared the list |
| SCN-FSPEC-075 | implemented | Edit adds a skill to an agent that has none and leaves factory.yaml as it is |
| SCN-FSPEC-076 | implemented | Edit removes a skill from an agent |
| SCN-FSPEC-077 | implemented | Edit removes a secret reference and keeps the list on one line |
| SCN-FSPEC-078 | implemented | Edit removes an egress host from an agent that shares its sandbox |
| SCN-FSPEC-079 | implemented | Edit adds a secrets provider |
| SCN-FSPEC-080 | implemented | Adding the secrets provider at the range it is declared with prints factory.yaml unchanged |
| SCN-FSPEC-081 | implemented | Edit refuses a secrets provider that is declared at another range |
| SCN-FSPEC-082 | implemented | Adding a skill the agent has already prints factory.yaml unchanged |
| SCN-FSPEC-083 | implemented | Removing an egress host the agent does not have prints factory.yaml unchanged |
| SCN-FSPEC-084 | implemented | Edit refuses a secret reference whose provider is not declared and changes nothing |
| SCN-FSPEC-085 | implemented | Edit refuses an egress host for an agent without a sandbox |
| SCN-FSPEC-086 | implemented | Edit refuses an agent the factory does not declare |
| SCN-FSPEC-087 | implemented | Edit refuses a factory.yaml that does not pass lint and names every problem on one line |
| SCN-FSPEC-088 | implemented | Edit writes a value with YAML syntax in it as one string |
| SCN-FSPEC-089 | implemented | Edit names its usage for an edit it does not know |
| SCN-FSPEC-090 | implemented | Edit names its usage when an argument is missing |
| SCN-FSPEC-091 | implemented | Plan with --check accepts a factory.lock that pins every registry server and no adapter |
| SCN-FSPEC-092 | implemented | Plan with --check names a registry server that factory.lock does not pin and writes no lock |
| SCN-FSPEC-093 | implemented | Plan with --check names each adapter that factory.lock does not pin for its range |
| SCN-FSPEC-094 | implemented | Edit keeps an anchor that no alias uses |
| SCN-FSPEC-095 | implemented | Lint refuses a skill without a description |
| SCN-FSPEC-096 | implemented | Lint names the secret an agent lacks for its skill |
| SCN-FSPEC-097 | implemented | Lint names the host an agent's sandbox lacks for its skill |
| SCN-FSPEC-098 | implemented | Lint accepts an agent that declares the secret and the host its skill needs |
| SCN-FSPEC-099 | implemented | Lint accepts a SKILL.md with the fields of Claude Code and the metadata of Codex and OpenCode |
| SCN-FSPEC-100 | implemented | Lint asks an agent without a sandbox for no host of its skill |
| SCN-FSPEC-101 | implemented | Lint names a skill folder without a SKILL.md |
| SCN-FSPEC-102 | implemented | Lint names a SKILL.md without front matter |
| SCN-FSPEC-103 | implemented | Lint names the line of front matter that does not parse, and a front matter that is no mapping |
| SCN-FSPEC-104 | implemented | Lint names each name the format does not allow |
| SCN-FSPEC-105 | implemented | Lint names a skill whose name is not the name of its folder |
| SCN-FSPEC-106 | implemented | Lint accepts a name, a description and a compatibility at the format's limits and names each over them |
| SCN-FSPEC-107 | implemented | Lint names metadata that is no mapping and needs it cannot read |
| SCN-FSPEC-108 | implemented | Lint warns about a SKILL.md of 500 lines and accepts one of 499 |
| SCN-FSPEC-109 | implemented | Lint refuses a skill with a file that is not UTF-8 text |
| SCN-FSPEC-110 | implemented | Lint refuses two skills with one name and accepts one skill for two agents |
| SCN-FSPEC-111 | implemented | Edit refuses a skill whose secret the agent lacks and names it |
| SCN-FSPEC-112 | implemented | Lint names a skill path that is no folder |
| SCN-FSPEC-113 | implemented | Lint names a SKILL.md whose front matter is not closed or does not start on its first line |
| SCN-FSPEC-114 | implemented | Lint names a SKILL.md that is not UTF-8 text once |
| SCN-FSPEC-115 | implemented | The skills are printed with their needs, their agents and the Markdown below the front matter |
| SCN-FSPEC-116 | implemented | A skill that lint refuses is printed with its problems |
| SCN-FSPEC-117 | implemented | A factory.yaml that does not fit the contract fails "factory skills" with its problems |
| SCN-FSPEC-118 | implemented | What "factory skills" prints is a valid skill catalog of the contracts, also for a skill that lint refuses |
| SCN-FSPEC-119 | implemented | A command that factory does not have prints the help and exits with code 2 |
| SCN-FSPEC-120 | implemented | Plan pins a skill of another repository with its commit and the hash of its files |
| SCN-FSPEC-121 | implemented | Plan keeps a pin while its entry is unchanged, also when its branch moves, and shows the old and the new commit when its ref changes |
| SCN-FSPEC-122 | implemented | Plan refuses a fetched skill that the rules of lint refuse, names the file by its entry, and writes no factory.lock |
| SCN-FSPEC-123 | implemented | Lint refuses a local skill and a skill of another repository with one name |
| SCN-FSPEC-124 | implemented | Lint names an entry of another repository without a folder or outside it, and warns about one without a pin |
| SCN-FSPEC-125 | implemented | "factory plan --check" names a skill of another repository that factory.lock does not pin, and writes nothing |
| SCN-FSPEC-126 | implemented | Render links a skill of another repository at the commit of its pin, also after its branch moved |
| SCN-FSPEC-127 | implemented | Render refuses a skill of another repository that factory.lock does not pin |
| SCN-FSPEC-128 | implemented | "factory skills" prints a pinned skill with its repository and commit, and one without a pin with its problem |
| SCN-FSPEC-129 | implemented | Lint names the line and column of an entry of an agent that it refuses, and what is wrong |
| SCN-FSPEC-130 | implemented | Lint accepts a stage that sends a failed check back to an earlier stage that runs an agent |
| SCN-FSPEC-131 | implemented | Lint reports a stage that sends a failed check back to a stage that cannot take it |
| SCN-FSPEC-132 | implemented | Render writes the stop check as the Stop hook of Claude Code and keeps the settings a person wrote |
| SCN-FSPEC-133 | implemented | The rendered Stop hook skips a second stop and a clean tree, and ends with code 2 when the check fails |
| SCN-FSPEC-134 | implemented | Render says which harness cannot run the stop check and writes none for it |
| SCN-FSPEC-135 | implemented | Lint refuses a stop check without a command |
| SCN-FSPEC-136 | implemented | Plan reports a Stop hook changed by hand as drift |
