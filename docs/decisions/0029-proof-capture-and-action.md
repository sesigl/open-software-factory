---
status: accepted
date: 2026-10-20
---

# 0029. proof captures a running product, runs as a GitHub Action, and checks this repository's pull requests

## Context

ADR 0028 shipped the first slice of T-05: `proof bundle`, `verify` and `attach`. It left three parts open:

1. `proof capture`: screenshots and video of a running product, with Playwright and Playwright MCP. Not every
   behavior has a Playwright test. An agent that changed a page should still show the page.
2. The GitHub Action, so a workflow needs one step instead of three commands.
3. The dogfood: a proof check on every pull request of this repository.

The testkit has no way yet to run a module's GitHub Action, to serve an HTML page, or to let a module find the
browsers Playwright installed (it starts the module with `HOME` in its working folder).

## Decision

- **`proof capture <url> --scenario <id> [--expect <text>] [--out <folder>]`** opens the URL in headless Chromium
  with Playwright, records a video and a Playwright trace, and takes a full-page screenshot after the page loaded.
  With `--expect`, the page must show the text within 5 seconds. A page that answers 400 or more, or does not show
  the text, is a failed capture: proof still writes its files and exits with code 1.
- **`proof capture --from <folder> --scenario <id>`** takes the files an agent saved with Playwright MCP
  (`--output-dir`, `--save-video`, `--save-trace`) or any other tool: every `.png`, `.jpg` and `.jpeg` is a
  screenshot, every `.webm` a video, every `.zip` a trace. Other files are left out. A folder without one of them is
  refused.
- **The capture report is a Playwright JSON report.** Both forms write the files to `<out>/<scenario ID>/` and
  add one spec titled `<scenario ID> <url or folder>` to `<out>/report.json` (default `$OUTPUT/capture`). A second
  capture of the same scenario replaces its spec. `proof bundle --playwright <out>/report.json` then bundles it like
  any Playwright run, so bundle, verify and attach need no change.
- **Browser.** proof depends on `playwright-core`, which downloads no browser. The user installs Chromium once
  with `npx playwright-core install chromium`; `PLAYWRIGHT_BROWSERS_PATH` says where it is, as in Playwright.
- **The GitHub Action** is `modules/proof/action.yml`, a composite action:
  `uses: sesigl/open-software-factory/modules/proof@proof-v<version>`. Inputs: `playwright` and `junit` (paths or
  globs, one per line), `scenarios` (the IDs that must pass, default every scenario of the bundle), `token`
  (default `github.token`) and `command`. Its script `action.sh` bundles the reports into `$RUNNER_TEMP/proof/evidence`
  for the head commit of the pull request (or `GITHUB_SHA`), verifies the bundle, and on a pull request attaches it
  with a link to the workflow run. Then it uploads the bundle as the artifact `proof`. It fails when the
  verification failed, after the attach, so the pull request shows why. By default it runs
  `npx --yes @opensoftware/proof@<version>`, where `<version>` is the `version` of the `package.json` next to the
  action: the action of a release runs the package of the same release.
- **Dogfood.** The job `verify` of `.github/workflows/verify.yml` runs the action from the checkout
  (`uses: ./modules/proof`) on the JUnit reports of every suite, on each pull request from this repository. Until
  `@opensoftware/proof` is on npm, `command` runs the built `modules/proof/dist/cli.js`; then the job switches to the
  released package and T-05 is done. The job gets `pull-requests: write` for the comment.
- **Testkit.**
  - `sut.action(inputs, { event, env })` runs the module's composite `action.yml` like a runner: each `run` step in
    bash with `$INPUT` as the workspace, the `GITHUB_*` and `RUNNER_TEMP` variables, the event payload in
    `GITHUB_EVENT_PATH`, and the step outputs from `GITHUB_OUTPUT`. It fills the input `command` with the module's
    built `bin`, so the action runs the module under the guards. It skips `uses` steps and names them. It supports
    only the expressions `${{ inputs.<name> }}`, `${{ github.action_path }}` and `${{ github.token }}`, and fails the
    scenario on any other.
  - A `fakes.http` route with `contentType` answers its `body` text as is, for example an HTML page.
  - The module gets `PLAYWRIGHT_BROWSERS_PATH` from the testkit's own environment, like `PATH`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Capture writes a Playwright JSON report (chosen) | bundle, verify and attach stay as they are; one format | A capture is not a test run; the report says `expected` for a page that loaded |
| Capture writes into a bundle directly | One command less | A second way to build a manifest; capture and test runs of one pull request would not join |
| A step file that clicks and types | Covers flows | A small test language next to Playwright's; a flow is a Playwright test, which bundle already reads |
| Composite action with a bash script (chosen) | No build output in Git; runs the npm package of its own release | Needs bash and Node on the runner, which GitHub's runners have |
| JavaScript action (`node24`) | Typed inputs | The bundled `dist/` must be committed for every release |
| `playwright` package | Installs a browser on `npm install` | A download for every user of bundle, verify and attach |
| `playwright-core` (chosen) | No download; the same API | The user installs Chromium once |
| Run the action with `act` | Runs any action | Needs Docker images of the runner; slow; not a fake |

## Prior art

- Playwright (Apache-2.0, Microsoft, very active): `playwright-core` 1.56.1 is adopted for capture
  (`recordVideo`, `tracing`, `screenshot({ fullPage })`). 1.56.1 matches the Chromium build of the cloud development image; CI installs the
  same build. Newer versions follow with their browser.
- Playwright MCP (`@playwright/mcp`, Apache-2.0, Microsoft, active, 0.0.83): the MCP server agents use for computer
  use. It saves screenshots, videos and traces into `--output-dir`. Adopted as a source of `capture --from`, not as a
  dependency.
- shot-scraper (Apache-2.0, Simon Willison, active): takes screenshots of URLs from the command line with
  Playwright. Python, no video or trace, no scenario ID.
- Percy and Chromatic (commercial): visual review of screenshots per pull request. Paid services that compare
  pixels; proof records evidence per scenario.
- actions/upload-artifact (MIT, GitHub, active): adopted in the action to keep the bundle with the run.
- nektos/act (MIT, active): runs GitHub workflows locally in Docker. Too slow and too broad for a system test of
  one composite action; the testkit runs the `run` steps itself.

## Consequences

- An agent proves a changed page without writing a test: capture the page, bundle, attach.
- Any repository adds proof to a workflow with one `uses:` step; the action of a release runs that release.
- This repository's pull requests show a `proof` status and one proof comment.
- spec-trace (T-06) can ship its own GitHub Action and test it with `sut.action`.
- Revisit the step file when people capture the same flow by hand often enough; revisit the pinned
  `playwright-core` with each browser update of the runner image.
