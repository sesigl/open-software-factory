# AGENTS.md for module `proof`

Adds rules for this module. The root `AGENTS.md` applies in full. Decision: ADR 0028.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `proof <command>` (see `README.md#commands`)
- Input: Playwright JSON reports, JUnit XML reports and their attachment files, named on the command line, in the
  current folder (`$INPUT` in tests); the Git repository in the current folder for the commit; a bundle folder for
  `verify` and `attach`
- Output: the bundle folder (`$OUTPUT/evidence` or `--out`) with `evidence.json`; a comment and the commit status
  `proof` on a GitHub or Forgejo pull request at `PROOF_FORGE_URL`; the bundle's files in an S3-compatible store
- Formats: the `evidence-bundle` contract (`contracts/evidence-bundle/`)
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` decides which test proves which scenario, where its files go, the manifest, the verdicts and the
comment, without I/O; `adapters` read reports and bundle files, ask Git, call the forge API and upload to the store;
`commands` join them and validate every manifest against the contract. The ARCH check enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 120 seconds in total on the CI runner. The attach scenarios need Docker (Forgejo, SeaweedFS).

## Scenario prefix

`SCN-PROOF-NNN`
