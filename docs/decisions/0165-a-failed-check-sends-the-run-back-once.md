---
status: accepted
topic: factory
date: 2026-11-17
---

# 0165. A failed check sends the run back once

## Context

A stage that names checks starts only when they succeeded on the run's pull request (ADR 0069); a stage that only
waits does nothing else (ADR 0107). When a required check fails, the stage fails and so does the run, and a person has
to start a new run (ADR 0105). The most common cause is a small mistake that the agent that made the change could fix
if it saw the failed check: a lint error, a test it broke, a generated file it did not update. This repository's own
factory waits for the check `verify` in its stage `verify` (`deploy/dogfood/factory/factory.yaml`), and every failed
`verify` ends its run today (`TODO.md` T-98).

## Decision

- A stage of `workflow` may name `rework: <stage>`, an earlier stage that runs an agent. When a check of the stage
  fails (`failure` or `error`), the run goes back to that stage once instead of failing: every stage after it up to
  the stage whose checks failed starts again as at its first time, gates and checks included, and the stage itself
  runs its agent again with the failed checks in its prompt. It keeps the decision of its gate, which approved it for
  this run: the reference factory has a gate before `implement`, and a person who approved the change should not be
  asked again because a test failed. Its own checks, if it has any, are read again. Then the later stages go on as
  usual, and the stage waits for its checks again, from the start of its limit (ADR 0106).
- Once means once per run and per stage that runs again: the stage keeps `rework` in the run's view, and a failed
  check that would send the run back to a stage that has it ends the stage as without the field, with the reason
  `the check <name> ended with <state>`. A pending check, a check that is still pending at the limit and a stage
  without a pull request end as without the field.
- The prompt of the stage that runs again ends with `# Failed checks of the stage <stage>`, a line that says the run
  came back once and fails when the checks fail again, and one line per failed check:
  `- <name>: <state>[: <description>][ (<url>)]`. The description and the URL are what the forge port's `pr` already
  prints for each check (`{"name", "state", "description", "url"}`); the foreman adds no port method. It does not
  fetch the CI job's log: the description and the link to the job are what every forge gives, and an agent with the
  forge's tools can read the log behind the link.
- The run's view shows why on the stage that ran again: `StageView.rework` with `failedAt` (the stage whose checks
  failed), `reason`, the failed `checks` with their description and URL, the `sessionId` of its run before and `at`.
  `run.completed@v1` lists the same as `reworks: [{stage, failedAt, reason}]`. Both are optional additions to the
  contracts (CONTRACT): a reader that does not know them reads the run as before.
- `factory lint` and `foreman serve` refuse a `rework` that names no stage before it, or a stage that only waits, and a
  `rework` on a stage that waits for no check (neither `checks` nor `evidence: required`), with the field's place.
- A run that started before this decision replays as it ran. The rework is in the facts the activities return: the
  activity that reads the checks adds it only when the run's definition, from the run's input, names `rework`, and a
  run that started before has no such field in its input. The one workflow change, the wait's start that a stage
  that runs resets, takes effect only when a stage reads its checks again after a later stage ran, which no run did
  before this decision; it adds no command to the history, so no `patched()` marker is needed.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `rework: <stage>` on the stage with the checks, once (chosen) | One optional field; the factory says where the fix is made; "once" needs no counter in the format | One try only; a factory that wants two has no way to say so |
| Always go back to the last stage that ran an agent | No field | Changes every factory's runs without asking; a stage before the agent that made the change may be the right one |
| `rework: {stage, times}` | A factory picks how often | A count invites loops that burn model calls; a second try rarely fixes what the first did not; the object can come later as a new form of the same field |
| The same for a gate's rejection | One mechanism for both | A rejection is a person's decision, not a check's output; whether it sends the run back is a question of its own (T-98 asks only for checks) |
| A new forge port method that reads the CI job's log | The agent sees the failing output | A port change in two adapters and the fake; the link to the job and the description already point there |

## Prior art

No new module, dependency or service. GitHub's Copilot coding agent and OpenHands' resolver re-run the agent on a
failed CI check of their pull request with the check's output; Argo Workflows and Tekton retry a failed step a fixed
number of times, without new input. The foreman already sends the result of one stage to the next (ADR 0111) and runs
a stage again for a new run (ADR 0105); this decision sends the failed checks back to an earlier stage within the run.

## Consequences

- A run whose change fails a check gets one fix by its agent before a person is asked to start over.
- A run that goes back costs one more session of the stage's agent, and of every agent between it and the stage with
  the checks.
- The stage that runs again has the same span ID in the run's trace as its first run (ADR 0121): the trace shows two
  spans with one ID. Revisit when the console shows a stage's runs one by one.
- A new run of a run (ADR 0105) that copies the stage that ran again keeps its `rework`, so it does not go back again;
  a new run from that stage or before starts it anew and may go back once more.
- This repository's factory and the reference factory can name `rework: implement` on their stage `verify` once a
  release of contracts, factory-spec and foreman carries this decision, because the released `factory lint` refuses an
  unknown field (ADR 0107).
