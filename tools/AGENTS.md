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

- System tests: 120 seconds in total on the CI runner.

## Quality limits

Checked by DUP (ADR 0036):

- Duplication: at most 3% of the source lines.

## Scenario prefix

`SCN-REPO-NNN`
