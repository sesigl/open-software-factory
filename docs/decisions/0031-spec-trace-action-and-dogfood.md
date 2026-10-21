---
status: accepted
date: 2026-10-21
---

# 0031. spec-trace runs as a GitHub Action, compares with a base commit, and checks this repository

## Context

ADR 0030 shipped the first slice of T-06: `spec-trace check`, `report` and `next-id`. It left three parts open:

1. The GitHub Action, so a workflow needs one step for the report and the rules.
2. The base and head diff in the report: a review should see which scenarios a change adds, removes or changes.
3. The dogfood: this repository's CI runs spec-trace instead of `tools/checks/` for SPEC, TRACE, STEPS and PASS.

Until now the four rules exist twice, in `tools/checks/` and in spec-trace (ADR 0030, Consequences). The testkit
runs a module's composite action, but gives it no job summary file.

## Decision

- **`spec-trace report --base <commit>`** compares the scenarios of the current folder with the feature files of
  the base commit. spec-trace reads them with `git ls-tree` and `git show` in the current folder, with the feature
  globs of the current settings. The report gains `changes`: `null` without `--base`, otherwise
  `{ base, added, removed, status, steps }`. `added` and `removed` are scenario IDs; `status` lists
  `{ id, from, to }`; `steps` lists the IDs whose step text changed. Only scenarios with exactly one ID count. The
  output line ends with `since the base: N added, N removed, N with a new status, N with new steps`. A base that is
  not a commit of the repository exits 2. The changes are information for the review, not a rule: whether a step
  of an implemented scenario may change stays with the review (SPECGUARD, `SCN-REPO-007`, stays deprecated).
- **`spec-trace report --summary <file>`** adds a Markdown summary to the end of the file: the heading
  `## spec-trace`, the totals, a table of the changes since the base, and a table of the findings. It appends, so it
  can write to `GITHUB_STEP_SUMMARY` after other steps.
- **The GitHub Action** is `modules/spec-trace/action.yml`, a composite action like proof's (ADR 0029):
  `uses: sesigl/open-software-factory/modules/spec-trace@spec-trace-v<version>`. Inputs: `rules` (default
  `SPEC,TRACE,STEPS,PASS`), `evidence` (proof bundle folders, one per line), `base` (default the base commit of
  the pull request; none on other events), `config` and `command`. Its script `action.sh` writes the report to
  `$RUNNER_TEMP/spec-trace/spec-trace.json` with the job summary, names it in the output `report`, then runs
  `spec-trace check --only <rules>`. Then it uploads the report as the artifact `spec-trace`. It fails when a rule
  has a finding. By default it runs `npx --yes @opensoftware/spec-trace@<version>` with the `version` of the
  `package.json` next to it. The base needs the history: the workflow checks out with `fetch-depth: 0`.
- **Testkit.** `sut.action` gives each step a job summary file in `GITHUB_STEP_SUMMARY` and returns its text as
  `summary`.
- **Dogfood.** A root `spec-trace.json` describes this repository: the feature folders of `docs/quality/checks.md`,
  the tests in `system-tests/`, the prefix table `docs/reference/scenario-prefixes.md` and the `@conformance`
  scenarios of `ports/`. `make check` runs `spec-trace check --only SPEC,TRACE,STEPS` and `make verify` runs
  `spec-trace check` from the source of the checkout (`node modules/spec-trace/src/cli.ts`), so no build is needed
  first. The job `verify` of `.github/workflows/verify.yml` also runs the action from the checkout on every pull
  request and push, with the base of the pull request. Until `@opensoftware/spec-trace` is on npm, its input
  `command` runs the built `modules/spec-trace/dist/cli.js`; then the job switches to the released package.
- **One copy of the rules.** `osf check` loses SPEC, TRACE, STEPS and PASS; `tools/checks/spec.ts` and the three
  rules in `tools/checks/trace.ts` are deleted. The scenarios `SCN-REPO-002` to `-005` and `SCN-REPO-030` are
  deprecated with their tests; spec-trace's `SCN-TRACE-001` to `-049` cover the same cases.
  `SCN-REPO-043` replaces `SCN-REPO-001`, whose last step named `SPEC ok`. FLAKE and BUDGET stay in `tools/`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Base from Git in the current folder (chosen) | One flag; works in any clone with history | Needs `fetch-depth: 0` in CI |
| Base as a second folder (`--base-dir`) | No Git | The user must check out the base first; the Action would do it anyway |
| Changes as a rule that fails on changed steps | Enforces the scenario rules | SPECGUARD was tried and deprecated: a rename or a typo fix needs a person, not a gate |
| `osf check` calls spec-trace for the four rules | `SCN-REPO-002` to `-005` stay | Two entry points for one rule; the scripts' fallbacks (no prefix table) differ from spec-trace's |
| `make` and CI run spec-trace directly (chosen) | One copy of the rules; the dogfood is the product | Five tools scenarios are deprecated |
| spec-trace from source in `make` (chosen) | `make check` needs no build | Node 24 type stripping; the Action and the release run `dist/` |

## Prior art

- dorny/test-reporter (MIT, active): shows JUnit results as a check run in GitHub. It knows test cases, not
  scenarios or their steps. Not adopted: it cannot tell which requirement a test proves.
- mikepenz/action-junit-report (Apache-2.0, active): JUnit results as annotations and a job summary. Same gap.
- cucumber/actions and Cucumber reports (MIT, active): publish Cucumber run reports. They need Cucumber step
  definitions; spec-trace traces plain system tests.
- OpenFastTrace (GPL-3.0, active) and gherkin-lint (ISC, low activity): checked in ADR 0030; neither diffs scenarios
  between commits.
- No new dependency: `git` is on every runner and in every clone; the Action reuses proof's composite pattern.

## Consequences

- Any repository can add one step for traceability: the report, a job summary with the changes of the pull
  request, and a failing check on a finding.
- The four rules exist once, in spec-trace. A fix to them is a spec-trace change with a scenario.
- T-06 is done once CI runs the released package, which waits for the first npm release of
  `@opensoftware/spec-trace`.
