---
status: accepted
date: 2026-11-13
---

# 0107. A stage that only waits for its checks, its evidence and its gate

## Context

Every stage of a factory runs an agent (ADR 0067); a stage without `agent` runs the agent with its name. The stage
`verify` of the reference factory and of this repository's factory has `agent: implement`, `checks: [verify]` and
`evidence: required`: once the checks and proof's check succeeded, the implement agent runs again with the implement
prompt. That is a second full session with a model, and it may push commits that no check has seen. `ship` after it
does not read the checks again (`TODO.md` T-40).

## Decision

- A stage of `workflow` may say `wait: true`. Such a stage runs no agent: it waits for its checks, for proof's check
  when it has `evidence: required` (ADR 0088), and for its gate, with the limits of ADR 0106, and then succeeds. It
  makes no model call, starts no sandbox and no harness session.
- A stage with `wait: true` names no `agent`, and it names at least one of `checks`, `evidence: required` or `gate`: a
  stage that waits for nothing is a mistake. `factory lint` and `foreman serve` refuse both, with the JSON Pointer of
  the field, as for the other rules a schema cannot express.
- The run's view shows such a stage without `agent` and without `sessionId`. `StageView.agent` becomes optional; the
  contract keeps every document valid that was valid before, so it is an addition (CONTRACT).
- `factory resolve` fills in a stage's agent only for a stage that runs one.
- The reference factory and this repository's factory give `ship` the checks `[verify]` and `evidence: required`, so
  `ship` starts only when `verify` and `proof` succeeded on the head commit of the run's pull request (the forge port's
  `pr` reads the head commit, ADR 0069). This works with the released images and lands now.
- The two factories switch `verify` to `wait: true` once a release of `contracts`, `factory-spec` and `foreman` carries
  this decision: the Compose profile and the chart run the released images (ADR 0095), whose `factory lint` refuses
  an unknown field. Until then their scenario stays `planned`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `wait: true`, a stage without an agent (chosen) | No model call, no session, no new commits; the wait is what the stage is for | A schema addition; the factories can use it only after a release |
| An agent `verify` with a prompt of its own that changes no file | No schema change; works with the released images today | Still one model call and a sandbox per run; "changes no file" is a request to the model, not a guarantee |
| A stage without an agent when the factory declares no agent of its name | No new field | A typo in an agent's name would silently turn a stage into a wait |
| `agent: none` | No new field | `none` is a valid agent name; the name would change meaning |

## Prior art

No new module, dependency or service. GitHub Actions' environments with required reviewers and Argo Workflows'
`suspend` template are steps that only wait for a condition or a person; Tekton has no step without a container. The
foreman already waits for checks and gates (ADR 0069, ADR 0106); this decision lets a stage do only that.

## Consequences

- A run of the reference factory has one implement session, and the commit that `ship` merges is one whose checks
  succeeded.
- A factory can add a stage that only waits, for example for a second check after a gate, without an agent and a
  prompt.
- The console shows no agent for a stage that waits.
- Revisit when a stage needs to do work without a model, like running a command: that is a stage with a command, not a
  wait.
