# AGENTS.md for module `proof`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0028, ADR 0029.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `proof <command>` (see `README.md#commands`)
- GitHub Action: `action.yml` and its script `action.sh`, run by `sut.action` with the built CLI as `command`
- Input: Playwright JSON reports, JUnit XML reports and their attachment files, named on the command line, in the
  current folder (`$INPUT` in tests); the Git repository in the current folder for the commit; a bundle folder for
  `verify` and `attach`; a page at a URL and a folder of screenshots, videos and traces for `capture`
- Output: the capture folder (`$OUTPUT/capture` or `--out`) with `report.json`; the bundle folder (`$OUTPUT/evidence` or `--out`) with `evidence.json`; a comment and the commit status
  `proof` on a GitHub or Forgejo pull request at `PROOF_FORGE_URL`; the bundle's files in an S3-compatible store
- Formats: the `evidence-bundle` contract (`contracts/evidence-bundle/`)
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` decides which test proves which scenario, where its files go, the manifest, the capture report, the
verdicts and the comment, without I/O; `adapters` read reports and bundle files, ask Git, drive Chromium, call the
forge API and upload to the store;
`commands` join them and validate every manifest against the contract. The ARCH check enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 120 seconds in total on the CI runner. The attach scenarios need Docker (Forgejo, SeaweedFS); the
  capture scenarios need Chromium (`npx playwright-core install chromium`, and `PLAYWRIGHT_BROWSERS_PATH` when it is
  not in the default folder).

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-PROOF-NNN`
