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

- System tests: 74 seconds in total on the reference runner. Lowered from 186 s on 2026-11-16, measured: `osf check
  <ID>` imported every check module, and with them dependency-cruiser, ts-morph (TypeScript), ajv and the native Astro
  template parser, about 0.5 s of each 0.65 s start. It now loads only the module of the check that runs, and
  dependency-cruiser and ts-morph only in the checks that use them: a start of `osf check PROFILE` takes 0.11 s,
  AFFECTED 0.29 s (ts-morph), ISOLATION with an import to check 0.70 s (dependency-cruiser), each with the testkit's
  coverage recorder. The 162 scenarios took 46.8 s summed on the development container instead of 117.4 s (median of
  three runs each, 4 workers; 42.9 s instead of 110.5 s with one worker). On CI the suite took 118.5 s on a runner at
  0.688 times the reference time before; the same ratio gives 47.2 s there, 68.7 s on the reference runner, and the
  budget is that plus 8%. Where the time goes now: about 0.1 s per scenario for Node, `osf` and the testkit; 0.15 to
  0.2 s more in the scenarios whose check loads ts-morph (AFFECTED, REACH, SURFACE, DEPS-RUNTIME, the BOUNDARY
  checks); 0.5 s more in the dozen that load dependency-cruiser (ARCH, BOUNDARY-STATIC, ISOLATION, `osf check`). A
  scenario may not test less.
- Before that: raised from 150 s to 186 s on 2026-11-16, measured on CI: 162 scenarios took 118.5 s on a runner at
  0.688 times the reference time, 172.2 s on the reference runner, plus 8%.
- Before that: raised from 120 s to 150 s on 2026-11-06, measured: the 24 scenarios of
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
