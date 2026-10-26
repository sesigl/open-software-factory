---
status: accepted
date: 2026-10-26
---

# 0068. foreman runs a stage in a sandbox through the sandbox port

## Context

ADR 0067 runs each stage's agent on the foreman's machine, in the run's folder. A factory can then only run agents it
trusts with that machine. TODO item T-17 lists the next slice: each stage runs in a sandbox through the sandbox port,
as the quick start "on Docker" says. The architecture says the same: "each stage is an activity that starts an inner
loop in a fresh sandbox" (`docs/architecture/internals.md`).

Much of it exists:

- An agent in `factory.yaml` may declare `sandbox` (template, CPU, memory, egress hosts) and `secrets` (references
  like `ref:file/linear-token`).
- The sandbox port is a command line with `create`, `exec`, `copy`, `snapshot`, `destroy`, `list` and `egress-log`
  (ADR 0054). `exec` passes its standard input and output, so a program in the sandbox can speak ACP on stdio. The
  docker and kubernetes adapters pass its conformance scenarios.
- The `sandbox-spec` contract is what `create` reads: template, CPU, memory, egress, plain variables, secrets by
  variable name and MCP servers.

Two things are missing. The foreman does not call the port. And a module's system tests need a sandbox adapter that
runs without Docker: the foreman's scenarios run on hosts without Docker (ADR 0067), and a real sandbox would need an
image with Node and the harness adapter in it.

## Decision

- **Which stages run in a sandbox.** A stage whose agent declares `sandbox` runs in a sandbox. A stage whose agent
  declares none runs on the foreman's machine, as before. The README says that only trusted agents should run that way.
- **Which adapter.** The factory names its sandbox adapter under `providers.sandbox`. It names at most one; a factory
  that names two stops the server at the start with `/providers/sandbox`. A factory that names none uses `docker`. The
  adapter's command line comes from `FOREMAN_SANDBOXES`, a JSON object from adapter name to command line, like
  `FOREMAN_HARNESSES`. An adapter it does not name runs `npx -y @opensoftware/sandbox-<name>`.
- **The spec.** The foreman builds the `sandbox-spec` from the agent:
  - `template`, `cpu`, `memory` and `egress` are the agent's `sandbox`.
  - `secrets` holds each of the agent's secret references under a variable name: the reference's name in upper case,
    with every character outside `A-Z` and `0-9` as `_`. `ref:file/linear-token` is `LINEAR_TOKEN`. The foreman never
    reads a secret; the adapter's egress proxy resolves it (ADR 0054).
  - `env` holds `OTEL_RESOURCE_ATTRIBUTES` with the run, as a stage on the host gets it (ADR 0067).
  - `mcp` stays empty in this slice: the agent's `mcp` names servers in a registry that does not exist yet. A sandboxed
    agent therefore reaches no MCP server, which is the safe default.
- **One fresh sandbox per stage.** The stage's activity:
  1. writes the spec to a file and runs `create`;
  2. runs `exec <ID> -- pwd` to learn the sandbox's working folder;
  3. copies the run's folder to `<ID>:<run ID>`, a path that does not exist yet, so every adapter copies the folder
     itself and not into a folder of the same name;
  4. runs the stage's harness adapter with `exec <ID> -- <harness command line>` and speaks ACP to it, with the session's
     folder `<working folder>/<run ID>`;
  5. when the turn ended, copies `<ID>:<run ID>` out to a new temporary folder and puts its files in the run's folder,
     so the next stage, in its own sandbox, finds them;
  6. runs `destroy`, also when the stage failed or a cancel ended it.

  A `create` that fails fails the stage like a harness that does not start: Temporal retries the activity up to 3
  times, then the run is `failed`.
- **The harness in the sandbox.** The harness command line is the same as on the host, from `FOREMAN_HARNESSES`; the
  template must hold that program. The foreman sends no other variables into the sandbox, so the adapter keeps its
  session records in its default folder inside the sandbox.
- **testkit: `fakes.sandbox()`.** A deterministic sandbox adapter for system tests, like `fakes.harness()` is a
  deterministic agent. It is a program with `create`, `exec`, `copy`, `destroy` and `list`. A sandbox is a folder on the
  host; `exec` runs the command there with the spec's variables and a placeholder for each secret. Its IDs are 12 hex
  digits, `000000000001` and on. It records each spec it got and, for each `exec`, the command and the files in the
  working folder at that moment. `fakes.sandbox({ templates })` refuses a template outside the list. It isolates
  nothing: it shows what a module asks of the port, and the adapters' conformance scenarios show what the port does.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| One fresh sandbox per stage | Each agent gets only its own template, egress and secrets; nothing leaks between stages | A create and two copies per stage |
| One sandbox per run | One create per run; files stay in place | The stages' agents differ in template, egress and secrets, and a spec is fixed at create |
| The harness on the host, its tools in the sandbox | No harness in the image | ACP has no way to send an agent's commands elsewhere; the agent would still read and write the host |
| Copy the run's folder in and out | Works with every adapter of the port, local or remote | Copies the folder twice per stage |
| Mount the run's folder | No copies | Not in the port; a remote sandbox (Kubernetes, E2B) cannot mount the foreman's folder |
| The real docker adapter in the foreman's tests | Tests the real thing | Needs Docker and an image with Node and the harness; the adapter's own scenarios already test it |
| `fakes.sandbox()` in the testkit | No Docker, deterministic, about 50 ms per call | Isolates nothing; a module could depend on a detail of the fake |

## Prior art

- The sandbox port and its docker and kubernetes adapters (ADR 0054, ADR 0055): adopted as they are. This slice
  changes neither the port nor an adapter.
- OpenHands (MIT, very active) runs each conversation in a Docker "runtime" with an action server inside, and copies
  files in and out. Checked again: its runtime is one sandbox per conversation, not per stage, and it is not a port
  other platforms can serve.
- E2B's and Daytona's SDKs (Apache-2.0 and AGPL-3.0, active) create a sandbox, run commands and copy files. Checked:
  they fit the same create, exec, copy and destroy order, so a community adapter of the port serves them.
- testcontainers (MIT, active), already in the testkit, starts containers for tests. Checked for the fake: it needs
  Docker, which the foreman's scenarios avoid (ADR 0067).

No new dependency.

## Consequences

- A factory can run an agent it does not trust: in a sandbox with its own resources, egress allowlist and placeholder
  secrets.
- A stage in a sandbox costs a create, two copies and a destroy. The docker adapter takes a few seconds for the create.
- A worker that dies during a stage leaves its sandbox behind; the retried stage creates a new one. `list` shows the
  leftovers. Revisit with labels on the port when that matters.
- The harness adapter's session record stays in the sandbox and is gone with it. The run's telemetry still reaches the
  collector when the egress allowlist names its host. Revisit when runlog collects records from sandboxes.
- MCP servers for sandboxed agents come with the MCP registry.
