---
status: accepted
date: 2026-10-22
---

# 0046. observer groups failed scores into problems, proposes reviewed fixes as pull requests and checks their effect

## Context

TODO item T-10 asks for observer: point it at scores and agent instructions; it proposes reviewed fixes and later
reports whether the failure rate fell. The vision asks to group repeated failures into one problem with links to the
failed runs (SCN-FACTORY-IMPROVE-001), to propose a fix as a pull request with problem, solution and evidence
(IMPROVE-002), to keep a person in the loop before it merges (IMPROVE-003), and to check a merged change with the
same scorer (IMPROVE-005). Principle P15 says the factory improves through the factory.

scorekit (ADR 0032) writes one `score` record per scored run. runlog (ADR 0023) writes run records, which name the
transcript and the pull requests of a run. The inference port (T-14) and the forge port (T-15) do not exist yet.

## Decision

- **New optional module `modules/observer`** (TypeScript, prefix `SCN-OBS`), published as `@opensoftware/observer`.
  Layers: `entry` (`src/cli.ts`) → `commands` → `adapters` → `domain`. `domain` groups scores into problems, writes
  the model prompt, reads and applies the model's edits, writes the pull request text and compares failure rates,
  without I/O; `adapters` read and write files, run Git, and call the model gateway and the forge API; `commands`
  join them. All three commands are deterministic except the model's answer in `propose`.
- **Analyze.** `observer analyze [--runs <file or folder>]... [--min-failures <n>] <scores file or folder>...` reads
  `score` records (`.jsonl`, checked against the contract). Only `BOOLEAN` scores count: 0 is a failure, 1 a pass.
  A run that one scorer scored twice counts once, with its latest score. A problem is one scorer that failed at least
  `--min-failures` runs (default 3); its ID is the scorer name. Each problem has the failures, the scored runs, the
  failure rate, its reasons by frequency (the score's `comment`), and each failed run with its reason and, from the
  run records of `--runs`, its links (`osf.transcript.uri` and `osf.pull_request.urls`). Problems are ordered by
  their failures, most first. It writes `$OUTPUT/problems.json` (or `--out`) and, with `--markdown`, a table.
  Grouping by scorer is exact and stable; a scorer is one failure mode by design (ADR 0032).
- **Propose.** `observer propose --repo <repository URL> [--problem <id>] [--file <path>]... <problems.json>` clones
  the repository, sends the problem and the instruction files (`--file`, default `AGENTS.md`) to the model, and
  applies the model's answer: one JSON object `{"solution": "...", "edits": [{"path", "old", "new"}]}`. Each `old`
  text must occur exactly once in its file; an empty `old` creates a file that does not exist. A path outside the
  repository, or an edit that does not apply, stops the command with exit 1 before anything is pushed. Then it
  commits on the new branch `observer/<problem>-<first 8 hex digits of the SHA-256 of the edits>`, pushes only that
  branch and opens a pull request into the repository's default branch. observer never pushes to the default
  branch.
- **Pull request text.** Title `observer: <problem> failed <n> of <m> runs`. The description has the sections
  `## Problem` (scorer, counts, reasons), `## Solution` (the model's solution and the changed files) and
  `## Evidence` (each failed run with its reason and links, at most 20, and the `observer check` command to run after
  the merge). A change to a protected path (`.github/**`, `**/*.rego`, `**/CODEOWNERS`) gets the title prefix
  `[needs human] ` and a line that names the path: it changes checks, approvals or ownership. Every observer pull
  request needs a person's review to merge (IMPROVE-003); the protected mark asks for the factory engineer, not any
  reviewer. gatekeeper (T-11) will enforce it.
- **Evidence gate.** From backpass: a proposal needs at least two distinct failed runs. `propose` refuses a problem
  with fewer.
- **Model call.** One OpenAI-compatible `POST <OBSERVER_INFERENCE_URL>/chat/completions`, temperature 0, model
  `--model` (default `observer`, a gateway alias), bearer `OBSERVER_INFERENCE_KEY` when set. The answer may sit in a
  Markdown code fence. Any other answer exits 1 with the reason. The inference port (T-14) replaces the URL later.
- **Forge.** GitHub and Forgejo answer `GET /repos/<owner>/<repo>`, `POST /repos/<owner>/<repo>/pulls`,
  `GET /repos/<owner>/<repo>/pulls/<n>` and `POST /repos/<owner>/<repo>/issues/<n>/comments` alike. The API base is
  `https://api.github.com` for github.com and `<origin>/api/v1` otherwise; `OBSERVER_FORGE_URL` overrides it.
  `OBSERVER_FORGE_TOKEN` goes to the API as `Authorization: token` and to Git as a basic-auth header for one command,
  never into a file or a remote URL. The forge port (T-15) replaces this later.
- **Check.** `observer check --problem <id> (--merged-at <time> | --pull-request <URL>) [--min-runs <n>]
  [--comment] <scores>...` splits the problem's scorer's scores at the merge time: before, and at or after. Per side
  it counts runs and failures (same rules as `analyze`). The verdict is `not enough runs` when a side has fewer than
  `--min-runs` (default 20), else a two-sided two-proportion z-test at 5%: `fell`, `rose` or `no clear change`. It
  writes `$OUTPUT/check.json` and prints one line. `--pull-request` reads `merged_at` from the forge; a pull request
  that is not merged exits 1. `--comment` posts the line on the pull request.
- **Formats.** `problems.json` and `check.json` are observer's own output, read only by observer and people. They are
  documented in the README, not in `contracts/`. Revisit when a second module reads them (console's inbox, T-18).
- **Testkit.** `fakes.forge` gains `pullRequests(repository)` (number, title, body, head and base branch, URL) and
  `file(repository, path, ref)`, so a test sees the pull request a module opens and the files of a branch
  (`SCN-TK-050`).
- **Release.** release-please with the tag `observer-v<version>`, first version `0.1.0`, and
  `.github/workflows/publish-observer.yml`, like taskcapture (ADR 0043).
- **Later slice of T-10:** the dogfood. A nightly job runs `analyze` on this repository's scores and `propose` for
  the top problem; one merged observer pull request with a measured effect finishes the item. It needs scorekit's
  paid dogfood (T-21) for the scores and a paid model for `propose`, so it waits for the owner's go.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Group by scorer | Exact, stable and explainable; a scorer is one failure mode | Two causes of one scorer's failures are one problem |
| Cluster reasons with embeddings or a model | Finds sub-causes | Not deterministic; needs a model for analysis too |
| Edits as exact `old` and `new` text | Small, reviewable diffs; a wrong edit fails before any push | The model must quote the file exactly |
| Whole new file content | Simple for the model | Large answers; silent loss of unrelated lines |
| Git clone and push, then the pulls API | One code path for GitHub and Forgejo; works for any file | Needs `git` on the PATH |
| Forge contents API | No Git | GitHub and Forgejo differ: separate calls for branches and commits |
| `[needs human]` in the title | Works on every forge without label setup | A title prefix, not a filter in the forge UI |
| Labels | Filterable | Forgejo needs the label created first; GitHub and Forgejo differ |
| Two-proportion z-test | Standard, no dependency, a few lines | Approximate for small samples; `--min-runs` keeps samples large enough |
| Fisher's exact test | Exact for small samples | More code; not needed above 20 runs per side |

## Prior art

- backpass (MIT, kunchenguid, npm 0.1.37 of 2026-10-20, active): reads local harness transcripts, proposes evidence-
  backed edits to `AGENTS.md`, `CLAUDE.md` and skills, and applies them after a person approves each one. Evaluated,
  not adopted as a dependency: it reads transcripts, not scores or run records; it runs its analysis through an ACP
  agent (`acpx`), edits the local working copy interactively, and has no pull request or before-and-after check.
  Adopted ideas: an edit needs evidence from at least two distinct runs, and a person approves every edit.
- SkillOpt-Sleep (Microsoft, listed as MIT, research code): replays recurring tasks and keeps only changes that improve
  a held-out score. Not adopted: Python research code for one harness. Its held-out check is what `check` and
  taskcapture (ADR 0043) do for observer's pull requests.
- DSPy and GEPA prompt optimizers (MIT, active): optimize prompts against a metric. Not adopted: Python (ADR 0009),
  and they tune prompts in code, not a team's instruction files through reviewed pull requests.
- Renovate and Dependabot (AGPL-3.0 and MIT, active): bots that open pull requests on a branch of their own and never
  push to the default branch. Not adopted: dependency updates only. Their branch-per-change pattern shaped `propose`.
- The two-proportion z-test is a few lines of our own code; simple-statistics (ISC, maintained) has no such test.

## Consequences

- A team turns scorekit's scores into ranked problems with one command, and a problem into a reviewed pull request
  with a second. After the merge, `check` tells whether the failure rate fell.
- The quality of a proposal depends on the model. A wrong edit cannot reach the default branch: it fails to apply or
  waits in a pull request for a person.
- A problem that one scorer reports for two causes gets one proposal. Revisit grouping by reason when scorers grow
  broad.
- Until the forge port exists, observer supports GitHub and Forgejo only.
