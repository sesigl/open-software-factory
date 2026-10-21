---
status: accepted
date: 2026-10-21
---

# 0032. scorekit grades agent sessions with calibrated LLM judges

## Context

TODO item T-07 asks for scorekit: grade a team's agent sessions on concrete failure modes, with judges that are
checked against human labels. The vision asks that a scorer judges sampled runs with pass or fail and a reason
(SCN-FACTORY-SCORE-001), samples runs to control its cost and records that cost (SCORE-002), shows its pass rate
over time (SCORE-003), lets a company define its own scorers (SCORE-004) and lives in the factory repository as
code (CODE-006).

runlog (ADR 0023) already writes each run as one OTLP/JSON line with the `run-record` attributes. The `score`
contract (T-01) already fixes the result of one scorer on one run as a subset of Langfuse's create-score request.
scorekit joins the two: run records in, scores out. The inference port (T-14) does not exist yet.

This change is the first slice of T-07: the CLI `score`, `calibrate`, `report`, `push` and `scorers`, the scorer
file format, the scorer pack, and the npm release.

## Decision

- **New optional module `modules/scorekit`** (TypeScript, prefix `SCN-SCORE`), published as
  `@opensoftware/scorekit`. Layers: `entry` (`src/cli.ts`) → `commands` → `adapters` → `domain`. `domain` holds the
  scorer format, the transcript, the sampling, the verdict, the calibration and the report, without I/O;
  `adapters` read run files and scorer files, call the judge and Langfuse over HTTP and write output files;
  `commands` join them.
- **Scorer file.** One Markdown file per scorer: YAML front matter, then the judge prompt. The keys are `name`
  (default: the file name), `description`, `pass` (the pass criterion, one sentence, required), `sample` (share of
  runs to score, 0 to 1, default 1), `model` (the judge model, default `judge`, a gateway alias), `price` (`input`
  and `output` in USD per million tokens, optional) and `max_chars` (longest transcript, default 200000). An
  unknown key or a wrong type exits 2. The factory definition's `scorers.<name>.judge` points at this file.
- **Runs.** scorekit reads OTLP/JSON trace export requests, one per line, from the files and folders it is given
  (a folder: every `.jsonl` file below it). A run is the root span `invoke_agent` with its trace's other spans.
- **Transcript.** The judge sees a plain-text transcript: the run ID, harness, model, outcome, links, duration and
  tokens, then each step in time order: the messages of `chat` spans when the run carries prompt content
  (`gen_ai.input.messages`, `gen_ai.output.messages`), and each tool call with its name and, when present, its
  arguments and result. A transcript longer than `max_chars` loses its middle, with a marker that says how many
  characters were cut.
- **Judge call.** One OpenAI-compatible `POST <SCOREKIT_INFERENCE_URL>/chat/completions` per run, temperature 0,
  with the prompt and the pass criterion as the system message and the transcript as the user message.
  `SCOREKIT_INFERENCE_KEY`, when set, is sent as a bearer token. The judge answers one JSON object
  `{"result": "pass" | "fail", "reason": "..."}`. Any other answer, or an HTTP error, gives no score; the run is named
  on the error output, the other runs are still scored, and the command exits 1.
- **Sampling.** A run is scored when the first 32 bits of SHA-256 of `<seed>:<scorer name>:<run id>`, divided by
  2^32, are below `sample`. The seed is `--seed` (default 0). So the same run is always in or out for a scorer and a
  seed, whatever the order or number of the other runs, and a rerun costs nothing extra. `--sample` overrides the
  scorer's rate.
- **Score.** `score` appends one `score` record per scored run to `$OUTPUT/scores.jsonl` (or `--out`): `BOOLEAN`, 1
  for pass and 0 for fail, the reason as `comment`, source `API`, and in `metadata` the run ID, the scorer version
  (`sha256:` and the first 12 hex digits of the scorer file), the judge model and, with a `price`, the judge cost
  from the token usage the gateway reports. A run that already has a score of the scorer in that file is skipped,
  so a nightly job can rerun on all runs.
- **Calibrate.** `calibrate --labels <file>` judges every labeled run, without sampling, and compares with the
  labels: `score` records with source `ANNOTATION`, as a person writes them in Langfuse. It writes
  `$OUTPUT/calibration.json` (agreement, Cohen's kappa, the four counts, each disagreement with label, result and
  reason) and prints the agreement. `--min-agreement` exits 1 below the given share. A label without a run is
  named and not counted.
- **Report.** `report <scores>...` writes `$OUTPUT/report.json`: per scorer the runs scored, passes, fails, pass
  rate, cost, the pass rate per day, and each scored run with result, reason, time and cost. `--markdown <file>`
  writes the same as Markdown tables.
- **Push.** `push <scores>...` sends each score to Langfuse's `POST /api/public/scores` at `LANGFUSE_HOST`, with
  basic auth from `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`. Langfuse keeps one score per ID, so a second push
  sends nothing new. An HTTP error names the score and the status and exits 1.
- **Scorer pack.** The package ships five scorers in `scorers/`: `redundant-tests`, `change-requested`,
  `scope-creep`, `skipped-checks` and `needless-human-question`. `--scorer` takes a pack name or a file path;
  `scorekit scorers` lists the pack.
- **Testkit.** A scripted reply of `fakes.modelGateway` may carry `usage` (prompt and completion tokens), so the
  judge cost can be tested. `fakes.http` gains `headers()`, the headers of each request it received, so a test can
  check the Langfuse and gateway credentials a module sends.
- **Release.** release-please with the tag `scorekit-v<version>`, first version `0.1.0`, and
  `.github/workflows/publish-scorekit.yml`, like spec-trace (ADR 0030).
- **Later slices of T-07:** export of the scorers as Langfuse LLM-as-a-judge evaluators, and the dogfood: this
  repository's sessions in `runs/` scored nightly with the report linked from the README. The dogfood needs a paid
  judge model and waits for the owner's go.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Own small judge client over `fetch` | No SDK; any OpenAI-compatible gateway (LiteLLM, the future inference port); easy to fake | We write the prompt frame and the verdict parser ourselves |
| autoevals `LLMClassifier` | Ready classifier prompts with choice scores | Ties us to its OpenAI client and its prompt frame; no transcript of OTLP runs; cost still ours |
| Langfuse evaluators as the only runtime | No judge code in scorekit | Needs a running Langfuse; no calibration report; scores only what Langfuse samples |
| Hash-based sampling | Same decision per run on every rerun; no state | Not exactly 20 of 100; about 20 |
| Random sampling with a seed | Exact share per batch | Changes when the batch changes; reruns score other runs |
| Labels as `score` records with source `ANNOTATION` | One format; Langfuse annotations export as is | A label file needs the trace ID even when only the run ID matters |
| Labels as a CSV of run ID and result | Easy to type | A second format to keep |
| Scorer as Markdown with front matter | Prompt stays readable and diffable; one file per scorer | Needs a YAML parser |
| Scorer as YAML with an embedded prompt | One parser | Long prompts in YAML block scalars are hard to review |

## Prior art

- Langfuse (MIT core, active, releases weekly into 2026): traces, scores and LLM-as-a-judge evaluators that run
  inside Langfuse. Adopted as the score model (the `score` contract) and as a target (`push`). Not the only runtime:
  its evaluators need a running Langfuse and do not report agreement with human labels.
- autoevals by Braintrust (MIT, active, TypeScript and Python): LLM classifier and factuality scorers. Not adopted:
  its scorers are about model answers, not coding sessions, and it fixes the client and the prompt frame.
- promptfoo (MIT, active): `llm-rubric` assertions grade model outputs in test suites. Not adopted: it grades
  prompts against test cases, not stored agent sessions, and has no calibration against labels.
- DeepEval (Apache-2.0, active), Ragas (Apache-2.0, active) and OpenAI Evals (MIT, low activity): evaluation
  frameworks with LLM judges. Not adopted: Python (ADR 0009), and their metrics are about answers and retrieval.
- Arize Phoenix evals (Elastic License 2.0, active): judges over OTel traces. Not adopted: not an open-source
  license under our rules (ADR 0008).
- `yaml` (ISC, eemeli, active): the YAML parser of factory-spec. Adopted, the same version.

## Consequences

- A team can score its sessions with one command and any OpenAI-compatible gateway, and check a judge against its
  own labels before it trusts the judge.
- The transcript frame and the verdict format are scorekit's own. A change to them changes every score, so it
  changes the scorer version only when the file changes; revisit when a second module reads scores this way.
- Cost needs a `price` per scorer until the inference port (T-14) reports the cost of each call.
- Revisit hash-based sampling when a scorer needs an exact share per batch.
