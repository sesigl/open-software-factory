# AGENTS.md for `tools`

Adds rules for the repository tooling. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or another program may use the tooling:

- CLI: `osf <command>` (`tools/bin/osf.ts`, see `README.md#commands`), run in the repository it checks
- Make targets that call it (root `Makefile`)
- Environment variables: the list in `README.md#configuration`
- Input: the repository in the current directory (`$INPUT` in system tests) and its JUnit results in
  `reports/junit/`

`checks/` and `scaffold/` are private.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 150 seconds in total on the CI runner. Raised from 120 s on 2026-11-06, measured: the 24 scenarios of
  AFFECTED and RELEASE took the suite to 127.6 s. Each starts `osf` once or twice, and a start was 0.74 s. `osf` now
  turns on Node's compile cache and loads only the module of its command: 0.35 s per start, about 5% of the suite.
  The rest is the new scenarios themselves, about 1.6 s each. SCN-REPO-171 to -174 (`.tsx` in MUTATION, `osf mutation`,
  `osf mutation-plan` and REACH, ADR 0152) take about 3 s together: 1.3 to 1.4 s for each `osf check`, 0.1 to 0.2 s
  for each `--list` and plan, measured on the development container.

## Quality limits

Checked by DUP (ADR 0037):

- Duplication: at most 3% of the source lines.

## Scenario prefix

`SCN-REPO-NNN`
