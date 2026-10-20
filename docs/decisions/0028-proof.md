---
status: accepted
date: 2026-10-20
---

# 0028. proof bundles test evidence per scenario and attaches it to a pull request

## Context

TODO item T-05 asks for proof: any pull request shows screenshots, video and test results for each behavior it
claims (principle P10, vision scenarios `SCN-FACTORY-LOOP-008` and `-009`). The `evidence-bundle` contract
(`contracts/evidence-bundle/`, ADR 0012) already fixes the manifest `evidence.json`: the subject (repository,
commit, pull request), one entry per scenario ID with its result and artifact paths, and one entry per artifact
with kind, media type and SHA-256. Tests already produce the evidence: Playwright writes traces, screenshots and
videos and lists them in its JSON report; every JUnit report of this repository carries the scenario ID of each
test case. What is missing is the step that joins them by scenario ID, checks them, and shows them on the pull
request.

The forge port (T-15) does not exist yet. factory-spec already talks to Forgejo through its API v1 (ADR 0022), and
Forgejo's issue comment and commit status endpoints have the same shape as GitHub's.

This change is the first slice of T-05: `bundle`, `verify` and `attach`, and the npm release.

## Decision

- **New core module `modules/proof`** (TypeScript, prefix `SCN-PROOF`), published as `@opensoftware/proof`.
  Layers: `entry` (`src/cli.ts`) → `commands` → `adapters` → `domain`. `domain` builds and checks a manifest and
  writes the comment, without I/O; `adapters` read reports and files, ask Git, call the forge and the object store;
  `commands` join them and validate every manifest with `@opensoftware/contracts`.
- **`proof bundle --playwright <report.json> --junit <report.xml>`** (each repeatable) writes a bundle folder
  (default `$OUTPUT/evidence`) with `evidence.json`. A test belongs to the scenario IDs (`SCN-<PREFIX>-NNN`) in its
  titles, tags or annotations, or in the JUnit property `scenario`. A Playwright attachment with a file is copied to
  `artifacts/<scenario ID>/<file>`; its kind is `playwright-trace` for the attachment `trace`, `screenshot` for an
  image and `video` for a video. A JUnit report is copied to `junit/<file>` and proves every scenario in it. Results:
  Playwright `expected` is passed, `unexpected` and `flaky` are failed (a pass on retry is no pass, as in the check
  FLAKE), `skipped` is skipped; JUnit `failure` or `error` is failed. A scenario is failed when any of its tests
  failed, skipped when all were skipped, else passed. The bundle is passed only when every scenario passed. A test
  without a scenario ID is named on the error output and left out.
- **Subject.** The commit is `--commit` or `HEAD` of the Git repository in the current folder; the repository is
  `--repository` or, in GitHub Actions, `GITHUB_SERVER_URL/GITHUB_REPOSITORY`; the pull request is `--pull-request`.
  The bundle ID is a hash of the subject and the evidence, and `createdAt` is `OSF_NOW` or the clock, so the same
  evidence gives the same bundle.
- **`proof verify <bundle> [--scenario <id>]...`** checks the manifest against the contract, every artifact's
  SHA-256, and that each listed scenario (or, without a list, each scenario of the bundle) passed with at least
  one artifact. It prints one line per scenario and one per problem and exits 1 on any problem.
- **`proof attach <bundle> [--pr <url>] [--store s3://<bucket>/<prefix>] [--bundle-url <url>]`** posts one comment
  with a table of the scenarios and a link to the bundle, and sets the commit status `proof` on the bundle's commit
  to `success` or `failure` with the description `<n> of <m> scenarios passed`. The comment starts with the marker
  `<!-- proof -->`; a second run edits that comment instead of adding one, and a commit status is replaced by its
  context, so attach is idempotent. A pull request URL with `/pull/<n>` is GitHub (API at `PROOF_FORGE_URL`,
  default `https://api.github.com`); one with `/pulls/<n>` is Forgejo (API at `PROOF_FORGE_URL/api/v1`). The token
  is `PROOF_FORGE_TOKEN`. A commit status, not a check run, because both forges have it, GitHub's `GITHUB_TOKEN`
  may write it, and branch protection can require it.
- **Storage.** With `--store`, attach uploads every file of the bundle to `<prefix>/<bundle id>/` in an
  S3-compatible store (`AWS_ENDPOINT_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) with
  path-style URLs, and links its `evidence.json`. Without it, `--bundle-url` names where the bundle already is, for
  example a CI artifact.
- **Release.** release-please with the tag `proof-v<version>`, first version `0.1.0`, and
  `.github/workflows/publish-proof.yml`, like runlog (ADR 0024).
- **Later slices of T-05:** `proof capture` (screenshots and video of a running product with Playwright and
  Playwright MCP), the GitHub Action, and the dogfood: a proof check on every pull request of this repository from
  the released tool.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Read Playwright's JSON report | Lists every attachment with its test, tags and annotations; stable reporter | Only Playwright; other runners come through JUnit |
| Read Playwright's `test-results/` folder | No reporter to configure | Folder names are hashed titles; no result, no tags |
| Commit status `proof` | Same API on GitHub and Forgejo; `GITHUB_TOKEN` can write it; requirable | No rich output like a check run's summary; the comment carries it |
| GitHub check run | Rich summary and annotations | GitHub only, and only for a GitHub App or `GITHUB_TOKEN` in Actions |
| `aws4fetch` for S3 | One small file that signs `fetch` requests; no credential lookup | One maintainer, few releases |
| `@aws-sdk/client-s3` | The reference client | Large; looks for credentials in files and the instance metadata service |
| Wait for the forge port (T-15) | One forge client for every module | Blocks T-05; the two calls proof needs are the same on both forges |

## Prior art

- Playwright (Apache-2.0, Microsoft, very active): the JSON reporter (`reporter: [["json", { outputFile }]]`) lists
  suites, specs with `tags`, tests with `annotations`, `status` and results with `attachments` (`name`,
  `contentType`, `path`). Adopted as the input format. Playwright MCP is for `proof capture` in a later slice.
- Allure Report (Apache-2.0, Qameta, active): collects results and attachments into an HTML report. No manifest per
  scenario ID, no pull request check; a team may still link an Allure report with `--bundle-url`.
- ReportPortal (Apache-2.0, active): a server for test results. A service to run, not a file format; not adopted.
- dorny/test-reporter (MIT, active) and mikepenz/action-junit-report (Apache-2.0, active): GitHub Actions that turn
  JUnit into a check run. GitHub only, per test not per scenario, no screenshots or traces.
- Danger JS (MIT, active): posts and updates pull request comments from rules. A framework for review rules; the
  marker comment proof needs is two API calls.
- fast-xml-parser (MIT, active): reads JUnit XML; already used by the checks in `tools/` (ADR 0011).
- aws4fetch (MIT, 1.0.20, stable since 2024): AWS Signature V4 for `fetch`. Adopted for the S3 upload.
- No product joins scenario IDs, artifacts and a pull request check, so we build the joining step on these.

## Consequences

- Any repository whose tests name scenario IDs gets a per-scenario evidence bundle and a `proof` status with two
  commands, without a server.
- spec-trace (T-06) can read the same `evidence.json` to check that every changed scenario has evidence.
- When the forge port exists (T-15), attach moves its two forge calls behind it, and GitLab follows.
- Revisit aws4fetch if it stops working with a store the factory supports.
