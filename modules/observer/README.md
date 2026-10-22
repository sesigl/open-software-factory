---
covers: [modules/observer/src/**]
---

# observer

Turn repeated agent failures into reviewed fixes of your agent instructions, and measure whether they worked.
observer reads the scores that [scorekit](../scorekit/README.md) writes and groups the failed runs into problems:
one per scorer, with the count, the reasons and links to the failed runs. For a problem it asks a model for a small
change to `AGENTS.md` or another instruction file and opens a pull request with the problem, the solution and the
evidence. A person reviews and merges it. After the merge, `observer check` compares the failure rate before and
after. Decision: [ADR 0046](../../docs/decisions/0046-observer.md).

## Quick start

This quick start is scenario `SCN-OBS-001` and is tested on every change. Save four scores of the scorer
`research-skill-used` the way `scorekit score` writes them:

```jsonl scores.jsonl
{"id":"s1","name":"research-skill-used","value":0,"dataType":"BOOLEAN","traceId":"0af7651916cd43dd8448eb211c80319c","comment":"Investigated inline.","timestamp":"2026-01-01T10:00:00Z","source":"API","metadata":{"osf.run.id":"run-1"}}
{"id":"s2","name":"research-skill-used","value":0,"dataType":"BOOLEAN","traceId":"1af7651916cd43dd8448eb211c80319c","comment":"Investigated inline.","timestamp":"2026-01-01T11:00:00Z","source":"API","metadata":{"osf.run.id":"run-2"}}
{"id":"s3","name":"research-skill-used","value":0,"dataType":"BOOLEAN","traceId":"2af7651916cd43dd8448eb211c80319c","comment":"No call of the research skill.","timestamp":"2026-01-01T12:00:00Z","source":"API","metadata":{"osf.run.id":"run-3"}}
{"id":"s4","name":"research-skill-used","value":1,"dataType":"BOOLEAN","traceId":"3af7651916cd43dd8448eb211c80319c","comment":"Used the research skill.","timestamp":"2026-01-01T13:00:00Z","source":"API","metadata":{"osf.run.id":"run-4"}}
```

Find the problems:

```sh
npx @opensoftware/observer analyze scores.jsonl
```

It writes `$OUTPUT/problems.json` and prints `research-skill-used: failed 3 of 4 runs (75.0%)`.

## Commands

| Command | What it does |
| --- | --- |
| `observer analyze [--runs <file or folder>]... [--min-failures <n>] [--out <file>] [--markdown <file>] <scores>...` | Group the failed scores into problems: `$OUTPUT/problems.json` (or `--out`), and a Markdown table with `--markdown`. |
| `observer propose --repo <repository URL> [--problem <id>] [--file <path>]... [--model <model>] [--out <file>] <problems.json>` | Ask the model for a fix, push it to a branch of its own and open a pull request. Writes `$OUTPUT/proposal.json` (or `--out`). |
| `observer check --problem <id> (--merged-at <time> \| --pull-request <URL>) [--min-runs <n>] [--runs <file or folder>]... [--comment] [--out <file>] <scores>...` | Compare the problem's failure rate before and after the merge: `$OUTPUT/check.json` (or `--out`). |

`<scores>` are `.jsonl` files of `score` records ([contract](../../contracts/score/score.schema.json)), or folders
with such files below them. `--runs` names run records as runlog writes them.

## Analyze

A problem is one scorer that failed at least `--min-failures` runs (default 3); its ID is the scorer's name. Only
`BOOLEAN` scores count: 0 is a failure, 1 a pass. A run that one scorer scored twice counts once, with its latest
score. Problems come with the most failures first. Each problem in `problems.json` has:

| Field | What it holds |
| --- | --- |
| `id` | The scorer's name. |
| `failures`, `scored`, `failureRate` | Failed runs, scored runs and their share. |
| `reasons` | Each distinct reason (the score's `comment`) with its count, most frequent first. |
| `runs` | Each failed run with its `run` ID, `trace`, `time`, `reason` and `links`: the transcript and pull requests of its run record, from `--runs`. |

## Propose

```sh
export OBSERVER_INFERENCE_URL=http://localhost:4000/v1 OBSERVER_FORGE_TOKEN=...
npx @opensoftware/observer propose --repo https://github.com/acme/factory problems.json
```

`propose` takes the first problem, or the one `--problem` names. It needs at least two failed runs as evidence. It
clones the repository and sends the problem and the files of `--file` (default `AGENTS.md`) to the model at
`OBSERVER_INFERENCE_URL`, as `--model` (default `observer`). The model answers one JSON object:

```json
{"solution": "Tell the triage agent to use the research skill.", "edits": [{"path": "AGENTS.md", "old": "Investigate inline.", "new": "Use the research skill before you investigate."}]}
```

Each `old` text must occur exactly once in its file; an empty `old` creates a new file. When an edit does not apply,
`propose` exits 1 and pushes nothing. Otherwise it commits on the branch `observer/<problem>-<hash>`, pushes only
that branch and opens a pull request into the default branch. It never pushes to the default branch.

The pull request's description has the sections Problem, Solution and Evidence (each failed run with its reason and
links, at most 20) and the `observer check` command for after the merge. A change to a protected path
(`.github/**`, `**/*.rego`, `**/CODEOWNERS`) gets the title prefix `[needs human]`: it changes checks, approvals or
ownership, so the factory's owner reviews it.

## Check

```sh
npx @opensoftware/observer check --problem research-skill-used --pull-request https://github.com/acme/factory/pull/12 --comment scores
```

`check` splits the problem's scores at the merge: `--merged-at`, or the `merged_at` of the pull request on the forge.
A run's time is its start in its run record (`--runs`), else the time of its score. It prints one line like
`research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell` and writes `check.json`
with both sides, the p-value and the verdict:

| Verdict | When |
| --- | --- |
| `not enough runs` | A side has fewer than `--min-runs` runs (default 20). |
| `fell`, `rose` | The failure rate changed, and a two-sided two-proportion z-test gives p below 0.05. |
| `no clear change` | Otherwise. |

`--comment` posts the line on the pull request.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `OUTPUT` | string | `"."` | Folder of problems.json, proposal.json and check.json when --out is not given. |
| `OBSERVER_INFERENCE_URL` | string |  | Base URL of an OpenAI-compatible gateway for propose, like http://localhost:4000/v1. Required for propose. |
| `OBSERVER_INFERENCE_KEY` | string |  | Sent to the gateway as a bearer token, when set. |
| `OBSERVER_FORGE_URL` | string |  | Base URL of the forge API. Default: https://api.github.com for github.com, <origin>/api/v1 for Forgejo. |
| `OBSERVER_FORGE_TOKEN` | string |  | Token that may push a branch and open a pull request (propose) or read and comment on one (check). Sent to the forge API and to Git, never written to a file. |

## Releases

release-please opens a release pull request from the Conventional Commits under `modules/observer/`. Merging it
creates the tag `observer-v<version>`. The workflow `.github/workflows/publish-observer.yml` then builds the package
and publishes it to npm as `@opensoftware/observer`. When the newest tag is missing on npm, the next run of the
workflow on `main` publishes it. To publish a tag again, run the workflow by hand with the tag. The first release is
`0.1.0`; until `1.0.0`, a breaking change raises the minor version.

The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)): the
GitHub environment `npm`, a token only for the first version, then a trusted publisher for the workflow
`publish-observer.yml`. No credential is stored in the repository.

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-OBS-001 | implemented | A new user finds the problem in the sample scores from the README |
| SCN-OBS-002 | implemented | The help lists every command |
| SCN-OBS-003 | implemented | An unknown command shows the usage |
| SCN-OBS-004 | implemented | Analyze groups 30 failed scores of one scorer into one problem |
| SCN-OBS-005 | implemented | A failed run of a problem links to its transcript and its pull request |
| SCN-OBS-006 | implemented | A problem lists its reasons by frequency |
| SCN-OBS-007 | implemented | A scorer with fewer than 3 failures is no problem |
| SCN-OBS-008 | implemented | The option "--min-failures" sets how many failures make a problem |
| SCN-OBS-009 | implemented | A run that a scorer scored twice counts once, with its latest score |
| SCN-OBS-010 | implemented | Scores without many failures give no problem |
| SCN-OBS-011 | implemented | A line that is no score exits 2 and names the line |
| SCN-OBS-012 | implemented | The option "--markdown" writes the problems as a table |
| SCN-OBS-013 | implemented | Propose opens a pull request with the sections Problem, Solution and Evidence |
| SCN-OBS-014 | implemented | Propose changes only its own branch, never the default branch |
| SCN-OBS-015 | implemented | A proposal that changes a protected path is marked "needs human" |
| SCN-OBS-016 | implemented | An edit whose old text is not in the file opens no pull request |
| SCN-OBS-017 | implemented | A problem that is not in the file exits 2 and names the problems |
| SCN-OBS-018 | implemented | A problem with fewer than two failed runs gets no proposal |
| SCN-OBS-019 | implemented | Propose without a model gateway exits 2 |
| SCN-OBS-020 | implemented | Check reports that the failure rate fell after the merged change |
| SCN-OBS-021 | implemented | Fewer than 20 runs after the change give the verdict "not enough runs" |
| SCN-OBS-022 | implemented | The option "--min-runs" sets the runs each side needs |
| SCN-OBS-023 | implemented | A small drop within chance is no clear change |
| SCN-OBS-024 | implemented | A clear rise is reported as "rose" |
| SCN-OBS-025 | implemented | Check reads the merge time of the pull request from the forge |
| SCN-OBS-026 | implemented | A pull request that is not merged exits 1 |
| SCN-OBS-027 | implemented | The option "--comment" posts the result on the pull request |
| SCN-OBS-028 | implemented | Check places a run by its start in its run record, not by the time of its score |
| SCN-OBS-029 | implemented | An answer that is no proposal opens no pull request |
| SCN-OBS-030 | implemented | A repository URL that names no repository exits 2 |
| SCN-OBS-031 | implemented | A repository that cannot be cloned exits 1 |
| SCN-OBS-032 | implemented | A URL that is no pull request exits 2 |
| SCN-OBS-033 | implemented | A line that is not JSON exits 2 and names the line |
