---
covers: [modules/scorekit/src/**, modules/scorekit/scorers/**]
---

# scorekit

Grade a team's agent sessions on concrete failure modes. A scorer is a Markdown file with a judge prompt, a pass
criterion and a sampling rate. scorekit asks an LLM judge about each sampled run and writes one score per run, with
pass or fail, the reason and the judge's cost. `calibrate` checks a judge against labels a person wrote before you
trust it, and `report` shows each scorer's pass rate over time. Decision:
[ADR 0032](../../docs/decisions/0032-scorekit.md).

## Quick start

This quick start is scenario `SCN-SCORE-001` and is tested on every change. Save two runs as runlog writes them
([`modules/runlog`](../runlog/README.md)):

```jsonl runs.jsonl
{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"claude-code"}},{"key":"osf.run.id","value":{"stringValue":"run-01"}},{"key":"osf.harness.name","value":{"stringValue":"claude-code"}}]},"scopeSpans":[{"scope":{"name":"@opensoftware/runlog"},"spans":[{"traceId":"0af7651916cd43dd8448eb211c80319c","spanId":"0af7651916cd43dd","name":"invoke_agent","startTimeUnixNano":"1767258000000000000","endTimeUnixNano":"1767258060000000000","attributes":[{"key":"gen_ai.operation.name","value":{"stringValue":"invoke_agent"}},{"key":"gen_ai.request.model","value":{"stringValue":"claude-sonnet-5-5"}},{"key":"osf.outcome","value":{"stringValue":"succeeded"}}]},{"traceId":"0af7651916cd43dd8448eb211c80319c","spanId":"8448eb211c80319c","parentSpanId":"0af7651916cd43dd","name":"chat claude-sonnet-5-5","startTimeUnixNano":"1767258001000000000","endTimeUnixNano":"1767258003000000000","attributes":[{"key":"gen_ai.operation.name","value":{"stringValue":"chat"}},{"key":"gen_ai.input.messages","value":{"stringValue":"[{\"role\":\"user\",\"parts\":[{\"type\":\"text\",\"content\":\"Add a sum function with a test\"}]}]"}}]},{"traceId":"0af7651916cd43dd8448eb211c80319c","spanId":"af7651916cd43dd8","parentSpanId":"0af7651916cd43dd","name":"execute_tool Write","startTimeUnixNano":"1767258004000000000","endTimeUnixNano":"1767258004500000000","attributes":[{"key":"gen_ai.operation.name","value":{"stringValue":"execute_tool"}},{"key":"gen_ai.tool.name","value":{"stringValue":"Write"}},{"key":"gen_ai.tool.call.arguments","value":{"stringValue":"{\"file_path\":\"test/sum.test.ts\"}"}}]}]}]}]}
{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"claude-code"}},{"key":"osf.run.id","value":{"stringValue":"run-02"}},{"key":"osf.harness.name","value":{"stringValue":"claude-code"}}]},"scopeSpans":[{"scope":{"name":"@opensoftware/runlog"},"spans":[{"traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"4bf92f3577b34da6","name":"invoke_agent","startTimeUnixNano":"1767258000000000000","endTimeUnixNano":"1767258060000000000","attributes":[{"key":"gen_ai.operation.name","value":{"stringValue":"invoke_agent"}},{"key":"gen_ai.request.model","value":{"stringValue":"claude-sonnet-5-5"}},{"key":"osf.outcome","value":{"stringValue":"succeeded"}}]},{"traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"a3ce929d0e0e4736","parentSpanId":"4bf92f3577b34da6","name":"chat claude-sonnet-5-5","startTimeUnixNano":"1767258001000000000","endTimeUnixNano":"1767258003000000000","attributes":[{"key":"gen_ai.operation.name","value":{"stringValue":"chat"}},{"key":"gen_ai.input.messages","value":{"stringValue":"[{\"role\":\"user\",\"parts\":[{\"type\":\"text\",\"content\":\"Fix the login redirect\"}]}]"}}]},{"traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"bf92f3577b34da6a","parentSpanId":"4bf92f3577b34da6","name":"execute_tool Write","startTimeUnixNano":"1767258004000000000","endTimeUnixNano":"1767258004500000000","attributes":[{"key":"gen_ai.operation.name","value":{"stringValue":"execute_tool"}},{"key":"gen_ai.tool.name","value":{"stringValue":"Write"}},{"key":"gen_ai.tool.call.arguments","value":{"stringValue":"{\"file_path\":\"src/login.ts\"}"}}]}]}]}]}
```

Point scorekit at any OpenAI-compatible gateway, for example LiteLLM with a model alias `judge`, and score both runs:

```sh
export SCOREKIT_INFERENCE_URL=http://localhost:4000/v1
npx @opensoftware/scorekit score --scorer redundant-tests --sample 1 runs.jsonl
```

It appends two lines to `$OUTPUT/scores.jsonl`: one score per run in the format of the `score` contract
([`contracts/`](../../contracts/README.md)), with the value 1 for pass or 0 for fail and the judge's reason as
`comment`. It prints `scored 2 of 2 runs with redundant-tests: ...`.

## Commands

| Command | What it does |
| --- | --- |
| `scorekit score --scorer <name or file> <runs>...` | Judge each sampled run that has no score of the scorer yet in `--out` (`$OUTPUT/scores.jsonl`) and append its score. `--seed <n>` (0) and `--sample <0..1>` change the sampling. |
| `scorekit calibrate --scorer <name or file> --labels <file> <runs>...` | Judge every labeled run and write the agreement with the labels to `--out` (`$OUTPUT/calibration.json`). `--min-agreement <0..1>` exits 1 below it. |
| `scorekit report <scores>...` | Write each scorer's runs, passes, fails, pass rate, cost, pass rate per day and scored runs to `--out` (`$OUTPUT/report.json`); `--markdown <file>` writes the same as Markdown tables. |
| `scorekit push <scores>...` | Send the scores to Langfuse's score API (`POST /api/public/scores`). |
| `scorekit scorers` | List the scorers of the pack with their sampling rate and description. |

`<runs>` are files of OTLP/JSON trace export requests, one per line, or folders: every `.jsonl` file below a folder
is read. A run is the span `invoke_agent` with the other spans of its trace; its ID is `osf.run.id`. A wrong
option, scorer file or input file exits 2 before any judge call. A failed judge call or an answer without a verdict
is named on the error output; the other runs are still judged and the command exits 1.

## Scorer files

```markdown scorers/slow-tests.md
---
description: Tests wait for time to pass.
pass: No test waits longer than one second.
sample: 0.2
model: judge
price: { input: 3, output: 15 }
---
Look for sleep calls and fixed timeouts in the tests the agent wrote or ran.
```

| Key | Meaning |
| --- | --- |
| `name` | The scorer's name in each score. Default: the file name without `.md`. |
| `description` | One line for `scorekit scorers`. |
| `pass` | Required. The pass criterion, one sentence. |
| `sample` | Share of runs to score, 0 to 1. Default 1. |
| `model` | The judge model the gateway gets. Default `judge`. |
| `price` | `input` and `output` in USD per million tokens. With it, each score records the judge cost from the token usage the gateway reports. |
| `max_chars` | Longest transcript the judge reads. Default 200000. A longer transcript loses its middle, with a marker that says how many characters were cut. |

The text after the front matter is the judge prompt. Any other key exits 2. In a factory definition,
`scorers.<name>.judge` points at this file.

## What the judge sees

One chat completion per run, at temperature 0. The system message holds the prompt and the pass criterion and asks
for one JSON object: `{"result": "pass" | "fail", "reason": "..."}`. The user message is the transcript: the run
ID, harness, stage, model, outcome, pull requests, issues, duration and tokens, then each step in time order. A step
is a message of a `chat` span when the run carries prompt content (runlog `--include-content`), or a tool call with
its name and, when present, its arguments and result. Without prompt content the judge sees only the tool calls.

## Sampling

A run is scored when the first 32 bits of SHA-256 of `<seed>:<scorer name>:<run id>`, divided by 2^32, are below
`sample`. So the same run is always in or out for a scorer and a seed, whatever the other runs are. With 100 runs
and `sample: 0.2`, about 20 are scored. `score` skips a run that already has a score of the scorer in the output
file, so a nightly job can run on all runs and only pays for new ones.

## Calibration

Labels are score records with the source `ANNOTATION`, as a person writes them in Langfuse or by hand: `name` is
the scorer, `value` is 1 for pass or 0 for fail, and `metadata."osf.run.id"` names the run. `calibrate` judges
every labeled run without sampling and writes:

| Field | Meaning |
| --- | --- |
| `agreement` | Share of runs where the judge and the label agree. |
| `kappa` | Cohen's kappa: agreement beyond chance; `null` when chance explains it all. |
| `counts` | `truePass`, `falsePass` (judge pass, label fail), `trueFail`, `falseFail` (judge fail, label pass). |
| `disagreements` | Each run where they differ, with the label, the result and the judge's reason. |
| `missing` | Labels without a run in the runs files; they are named on the error output and not counted. |

It prints `agreement 18 of 20 (90.0%), kappa 0.80`. With `--min-agreement 0.8` it exits 1 below 80 percent.

## Scorer pack

The package ships these scorers in [`scorers/`](scorers/). Use them by name or copy one as a start:

| Scorer | Fails a run when |
| --- | --- |
| [`redundant-tests`](scorers/redundant-tests.md) | the agent added tests that prove nothing new |
| [`change-requested`](scorers/change-requested.md) | a person had to ask for changes after the agent said it was done |
| [`scope-creep`](scorers/scope-creep.md) | the agent changed more than the task asked for |
| [`skipped-checks`](scorers/skipped-checks.md) | the agent claimed success without running the checks |
| [`needless-human-question`](scorers/needless-human-question.md) | the agent asked a person something it could have found out itself |

## Langfuse

A score is a subset of Langfuse's create-score request, so `push` sends it as is to `$LANGFUSE_HOST/api/public/scores`
with basic auth from `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`. The score's `traceId` is the run's trace, so
the score appears on the run in Langfuse when the run was sent there too. Langfuse keeps one score per ID, and a
score's ID comes from the scorer and the run, so a second push changes nothing.

## Releases

release-please opens a release pull request from the Conventional Commits under `modules/scorekit/`. Merging it
creates the tag `scorekit-v<version>`, and `.github/workflows/publish-scorekit.yml` builds `dist/` and publishes
`@opensoftware/scorekit` to npm. The first release is `0.1.0`; until `1.0.0`, a breaking change raises the minor
version. The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)),
with a trusted publisher for `publish-scorekit.yml`. No credential is stored in the repository.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `OUTPUT` | string | `"."` | Folder of scores.jsonl, calibration.json and report.json when --out is not given. |
| `SCOREKIT_INFERENCE_URL` | string |  | Base URL of the OpenAI-compatible gateway of the judge, ending in /v1, for example http://litellm:4000/v1. Required by score and calibrate. |
| `SCOREKIT_INFERENCE_KEY` | string |  | API key of the gateway, sent as a bearer token. Never write the value into a file. |
| `LANGFUSE_HOST` | string | `"https://cloud.langfuse.com"` | Base URL of Langfuse for push. |
| `LANGFUSE_PUBLIC_KEY` | string |  | Langfuse public key for push. |
| `LANGFUSE_SECRET_KEY` | string |  | Langfuse secret key for push. Never write the value into a file. |
| `OSF_NOW` | string |  | The time of new scores as an ISO 8601 timestamp. Default: the system clock. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-SCORE-001 | implemented | A new user scores the sample runs from the README |
| SCN-SCORE-002 | implemented | The help lists every command |
| SCN-SCORE-003 | implemented | A run the judge passes gets the score 1 with the reason |
| SCN-SCORE-004 | implemented | A run the judge fails gets the score 0 |
| SCN-SCORE-005 | implemented | The judge gets the scorer's prompt, its pass criterion and the run's tool calls |
| SCN-SCORE-006 | implemented | The judge gets the run's messages when the run carries prompt content |
| SCN-SCORE-007 | implemented | A scorer with a sampling rate of 20 percent scores the runs its seed picks |
| SCN-SCORE-008 | implemented | The seed picks the same runs when the runs file lists them in another order |
| SCN-SCORE-009 | implemented | The option "--sample" overrides the scorer's sampling rate |
| SCN-SCORE-010 | implemented | The judge cost is recorded from the token usage and the scorer's price |
| SCN-SCORE-011 | implemented | A run that already has a score of the scorer is not judged again |
| SCN-SCORE-012 | implemented | An answer that is not a verdict gives no score and fails the command |
| SCN-SCORE-013 | implemented | A failed judge call is named and the other runs are still scored |
| SCN-SCORE-014 | implemented | A transcript longer than the scorer's limit loses its middle |
| SCN-SCORE-015 | implemented | A scorer file with an unknown key is refused |
| SCN-SCORE-016 | implemented | Without an inference URL the command names the missing variable |
| SCN-SCORE-017 | implemented | The inference key is sent as a bearer token |
| SCN-SCORE-018 | implemented | A folder of runs files is read |
| SCN-SCORE-019 | implemented | Calibration reports the agreement with 20 labeled runs |
| SCN-SCORE-020 | implemented | Calibration lists each disagreement with the label, the result and the reason |
| SCN-SCORE-021 | implemented | Calibration below the minimum agreement fails the command |
| SCN-SCORE-022 | implemented | A label without a run is named and not counted |
| SCN-SCORE-023 | implemented | The report shows each scorer's pass rate, cost and scored runs |
| SCN-SCORE-024 | implemented | The report shows the pass rate per day |
| SCN-SCORE-025 | implemented | The report is written as Markdown |
| SCN-SCORE-026 | implemented | Push sends every score to Langfuse with basic auth |
| SCN-SCORE-027 | implemented | A score Langfuse refuses is named and fails the command |
| SCN-SCORE-028 | implemented | The pack lists five scorers with their sampling rate and description |
| SCN-SCORE-029 | implemented | An unknown scorer name is refused with the names of the pack |
| SCN-SCORE-030 | implemented | A scorer file without a pass criterion is refused |
| SCN-SCORE-031 | implemented | A scorer file whose front matter is not YAML is refused |
| SCN-SCORE-032 | implemented | A runs file line that is not JSON is named with its file and line |
| SCN-SCORE-033 | planned | Export writes the five scorers of the pack as evaluators |
| SCN-SCORE-034 | planned | An exported evaluator carries the judge prompt and the pass criterion as a boolean score |
| SCN-SCORE-035 | planned | The evaluation rule samples the scorer's share of the runs and starts disabled |
| SCN-SCORE-036 | planned | The options "--provider" and "--model" set the evaluator's model |
| SCN-SCORE-037 | planned | Without "--model" the evaluator uses the project's default evaluation model |
| SCN-SCORE-038 | planned | The option "--model" without "--provider" is refused |
| SCN-SCORE-039 | planned | Push creates a missing evaluator and its disabled rule in Langfuse with basic auth |
| SCN-SCORE-040 | planned | Push with "--enable" creates the rule enabled |
| SCN-SCORE-041 | planned | Push leaves an evaluator alone when Langfuse already holds the same definition |
| SCN-SCORE-042 | planned | Push updates a changed evaluator and keeps its rule |
| SCN-SCORE-043 | planned | Push finds an evaluator on the second page of Langfuse's list |
| SCN-SCORE-044 | planned | An evaluator Langfuse refuses is named and fails the command |
| SCN-SCORE-045 | planned | Push without Langfuse keys names the missing variables |
