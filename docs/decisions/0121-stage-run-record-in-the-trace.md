---
status: accepted
date: 2026-11-14
---

# 0121. A stage's run record joins its span

## Context

Each run is one trace with a span per stage (ADR 0087), but the stage span says nothing about what the stage cost:
the tokens and the USD that the agent reported stay in the harness adapter's session record. `TODO.md` T-24 asks that
the session's run record join the stage's span "through `runlog attach` or the harness's `transcript`", and that the
console link each stage to its trace, not only the run.

Every harness adapter already records each session and writes its run record with `transcript <session ID>`
(`ports/harness`, ADR 0050): a valid `run-record` (contracts) with the summed `gen_ai.usage.*` tokens and
`osf.cost.usd`. runlog reads the session files of Claude Code, Codex and OpenCode, but not the record of an ACP
session, which is what the foreman drives.

## Decision

- **The harness's transcript.** With an OTLP receiver set, when a stage's turn ends the foreman runs the stage's
  harness adapter with `transcript <session ID>`: the adapter's command line up to its `run`, with the stage's
  `OSF_DATA` and `OUTPUT` set to `OSF_DATA/transcripts/<session ID>`. It reads `run-record.json` and puts every
  `gen_ai.usage.*` value (as an integer) and `osf.cost.usd` (as a double) on the stage's span. A transcript that
  fails is a warning, never a failed stage; the span is sent without them.
- **In a sandbox, inside it (amended).** A harness in a sandbox keeps its session record inside the sandbox. Before
  the foreman destroys the sandbox, it runs the adapter's command line up to its `run` with `transcript <session ID>`
  through the sandbox port's `exec`, as `env OUTPUT=.osf-transcripts/<session ID> …` in the sandbox's working folder
  (beside the run's folder, so the run's files stay as the agent left them), and copies that folder out with the
  port's `copy` to `OSF_DATA/transcripts/<session ID>`. No port change: `exec` and `copy` in both directions exist.
  The sandbox needs `env`, which every POSIX image has (SCN-FORE-163).
- **The view names the span.** A stage's view gets `spanId` when it starts (contracts `StageView`, additive). A stage
  copied from the run before keeps its session but not its span, which is in the other trace.
- **The console links each stage.** `CONSOLE_SPAN_URL` with `{traceId}` and `{spanId}` makes the stage's name a link
  to its span; the Compose profile sets it to Jaeger's `trace/{traceId}?uiFind={spanId}`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The harness's `transcript` (chosen) | Every adapter has it; reads the ACP session the foreman ran; one short process per stage | Only the totals, no span per model call or tool call |
| `runlog attach` after each stage | A span per model response and tool call below the stage | runlog cannot read an adapter's ACP session record; the foreman must find the product's session file, which is inside the adapter or the sandbox; one more program per run |
| The foreman sums the usage it saw on ACP | No process | Duplicates the adapter's run record; misses what only the adapter records |
| The console computes the stage span ID itself | No contract change | A second copy of the ID rule in another module |

## Prior art

- **OpenTelemetry GenAI semantic conventions** (CNCF, Apache-2.0): `gen_ai.usage.input_tokens` and
  `gen_ai.usage.output_tokens` on the span of the agent's invocation.
- **Jaeger UI** (CNCF, Apache-2.0): `/trace/<trace ID>?uiFind=<span ID>` opens the trace with the span highlighted.
- **runlog** (this repository, ADR 0023, 0024): checked for this; it stays the way to export a harness product's own
  session files, see the options.

## Consequences

- A stage span in the trace store shows the stage's tokens and cost; the console's run page links each stage to it.
- A configured harness command line must contain the word `run` before the adapter's own arguments, as the port asks.
- A sandboxed stage's run record reaches `transcripts/` too, so the improvement job (ADR 0123) sees the reference
  factory's stages. Like an unsandboxed stage, it does so only with an OTLP receiver set.
- Revisit when runlog reads an adapter's ACP session record.
