---
status: accepted
date: 2026-11-13
---

# 0111. The result of a stage in the next stage's prompt

## Context

T-44: a stage's result does not reach the next stage. Its prompt holds the agent's prompt file, the work item, the
run's branch and its pull request (ADR 0105, ADR 0109), so what triage found is lost unless the agent wrote it into a
file of the shared folder and the next prompt knew its name. The run is a Temporal workflow (ADR 0067): what it gives
the next stage must replay the same for runs that started before this change.

## Decision

The foreman puts what the stage before wrote into the next stage's prompt, under the heading
`# Result of the stage <stage>`:

- The result is the text of the agent's messages in its turn, without its tool calls, as the foreman already reads it
  to find the pull request (ADR 0069). An agent ends its turn with its summary, as the reference prompts ask, so the
  end of the text is its last message.
- It is bounded to its last 4000 characters. A longer text starts with the line
  `[… the first <n> characters are cut]`. The bound keeps the prompt and the workflow's history small: 4000
  characters are about 1000 tokens, and the history holds each stage's result once.
- `runStage` returns the bounded result in its `stage-ended` fact. The workflow keeps the last result in a local
  variable and hands it to the next `runStage` as one more argument. A stage without a result (a stage that only
  waits, ADR 0107, or an agent that wrote nothing) keeps the result of the stage before it.
- Replay: Temporal does not compare an activity's arguments on replay, and an older history's `stage-ended` fact has
  no result, so an older run replays with the same commands and its later stages get no result, as before.
- The result is not part of the run's view (`RunView` in `contracts/`): the API and the events do not change.

The reference prompts of `deploy/compose/factory/agents/` and the dogfood copies say that this section is the result
of the stage before.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The last message of the stage, bounded, through the workflow (chosen) | No agent has to know a file name; works in a sandbox, whose folder is copied back after the turn; replays, because only an argument and an optional field are new | A retry's first stage gets the line `Run before:`, not the result of the stage before it in the earlier run |
| A file of the run's folder that the reference prompts name, like `result.md` | Survives a retry, as the folder moves (ADR 0105); no change to the workflow | Every factory's prompts must name the file and every agent must write it; a factory with its own prompts gets nothing; a stale file of an earlier stage misleads the next one |
| The result in `StageView` of the run's view | Survives a retry; the console can show it | A change of `contracts/`; each query and event carries every stage's text |
| No bound | Nothing is lost | One long transcript fills the next prompt and the workflow's history (Temporal limits a payload to 2 MB) |

## Prior art

No new module, dependency or service. Pipelines of agents pass the output of one step as the input of the next:
LangGraph's state, CrewAI's `context` of a task (MIT, maintained) and GitHub Agentic Workflows' outputs of a job. We
follow the same idea with the foreman's own run, without a dependency.

## Consequences

- Triage's findings reach spec, and the next stage can start from the summary of the stage before.
- A retry's first stage does not get the result of the stage before it; it gets the line `Run before:`. Revisit when a
  run's view keeps results (for the console, T-45).
- An agent whose summary is longer than 4000 characters loses its beginning in the next prompt; the full text stays
  in the session's transcript.
