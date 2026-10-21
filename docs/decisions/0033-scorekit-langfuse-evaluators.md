---
status: accepted
date: 2026-10-21
---

# 0033. scorekit exports scorers as Langfuse LLM-as-a-judge evaluators

## Context

TODO item T-07 lists "export as Langfuse evaluators" in scorekit's public surface. ADR 0032 shipped the scorer
format, `score`, `calibrate`, `report` and `push`, and left the export for a later slice. A team that already sends
its runs to Langfuse may want Langfuse to judge new runs as they arrive, with the same scorers it calibrated with
scorekit, instead of a nightly `scorekit score` job.

Langfuse's public API v2 manages evaluators and evaluation rules: `POST /api/public/v2/evaluators` creates an
LLM-as-a-judge evaluator (prompt, model, output definition, default variable mapping), `PATCH
/api/public/v2/evaluators/{id}` replaces its definition as a new version, `GET /api/public/v2/evaluators` lists them
with a cursor, and `POST /api/public/v2/evaluation-rules` says which observations an evaluator scores and how often.
Evaluator names are not unique in Langfuse.

## Decision

- **New command `scorekit export`.** It takes `--scorer <name or file>` as often as needed (default: the five
  scorers of the pack) and writes one entry per scorer to `$OUTPUT/evaluators.json` (or `--out`): `evaluator`, the
  create-evaluator request, and `rule`, the create-rule request without its evaluator. No network call.
- **Evaluator.** Type `llm_as_judge`, the scorer's name and description. The prompt has two messages: a system
  message with the frame of ADR 0032 (the scorer's prompt and `Pass criterion: <pass>`, without the JSON answer
  line, because Langfuse asks for structured output itself) and a user message with the variables `{{input}}` and
  `{{output}}`, mapped by default to the observation's `input` and `output`. The output definition is `BOOLEAN`;
  its value instructions repeat the pass criterion and its reasoning instructions ask for one or two sentences.
- **Model.** `--provider` and `--model` together set `modelConfig`. Without them `modelConfig` is `null`, so Langfuse
  uses the project's default evaluation model. The scorer's `model` key is a gateway alias and is not exported. One
  of the two options alone exits 2.
- **Rule.** Named `scorekit <scorer>`, sampling the scorer's `sample`, one filter: the observation `name` is any of
  `invoke_agent`, the root span of a run (ADR 0023). The rule starts disabled, because an enabled rule makes
  Langfuse call a paid model for each new run; `--enable` turns it on.
- **Push.** `export --push` lists the project's evaluators (`limit=100`, following the cursor) with basic auth from
  `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`, at `LANGFUSE_HOST`. Per scorer, the newest evaluator with the
  same name is its match:
  - none: create the evaluator, then create its rule; print `created <scorer>`;
  - same description, prompt, output definition and model: send nothing; print `unchanged <scorer>`;
  - otherwise: `PATCH` the complete definition, which makes a new version in Langfuse and keeps its ID and rule
    assignments; print `updated <scorer>`.
  A rule is created only with a new evaluator, so a rule a person tuned in Langfuse stays as it is. An HTTP error
  names the scorer and the status; the other scorers are still exported and the command exits 1.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Langfuse public API v2 over `fetch` | Same client style as `push`; easy to fake with `fakes.http` | We follow API changes ourselves |
| Langfuse TypeScript SDK | Typed client | A large dependency for four calls; the SDK lags the v2 evaluator endpoints |
| Write a file only, a person imports it in the UI | No credentials | Langfuse has no import of evaluator files; manual copy of five prompts drifts |
| Match by name, compare the definition | No marker in Langfuse; a person's renamed copy is left alone | Two evaluators with the same name: the newest wins |
| Match by a version marker in the description | Cheap comparison | The description shows an internal hash to people |
| Rule disabled by default | No paid model calls without an explicit `--enable` | One more step for a team that wants live scoring |
| Transcript as the judge input | Same view as `scorekit score` | Langfuse fills variables from one observation; it has no transcript of child spans |

## Prior art

- Langfuse (MIT core, active, releases weekly into 2026): LLM-as-a-judge evaluators and evaluation rules through
  the public API v2 (`/api/public/v2/evaluators`, `/api/public/v2/evaluation-rules`). Adopted as the runtime of the
  exported evaluators; scorekit builds only the mapping from its scorer format.
- Langfuse TypeScript SDK (MIT, active): not adopted, see the options above.
- promptfoo (MIT, active) and autoevals (MIT, active) export no Langfuse evaluators; nothing else maps a judge
  prompt file to Langfuse evaluators.

## Consequences

- A team can run the same scorers live in Langfuse and nightly with scorekit from one set of scorer files.
- Langfuse's evaluator sees the root observation's input and output, not scorekit's transcript with every tool
  call. Scores from the two runtimes can differ; calibrate each before trusting it.
- No new dependency. Revisit when Langfuse changes its v2 evaluator API or adds names as identifiers.
