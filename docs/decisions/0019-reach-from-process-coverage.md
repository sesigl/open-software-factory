---
status: accepted
date: 2026-10-19
---

# 0019. REACH reads V8 coverage of the module's processes with v8-to-istanbul

## Context

System tests run the module as a separate process (BOUNDARY-RUNTIME), so the test runner's own coverage sees none of
the module's code. REACH must show which lines of a module no system test reaches, and fail a pull request that adds
such lines (docs/quality/checks.md). Modules run either from TypeScript (type stripping) or from built JavaScript.

## Decision

- The testkit loads a small recorder with `--import` into every Node process of the module. It starts V8 precise
  coverage through `node:inspector` and on exit (or SIGTERM) writes the scripts below the module root to
  `reports/coverage/` of the workspace, in the format of `NODE_V8_COVERAGE` plus the repository root. Unlike
  `NODE_V8_COVERAGE`, it leaves out node_modules and the test runner, so the files stay small.
- A demo module outside a workspace, as in the testkit's own tests, records into the coverage of the module that runs
  it, so the testkit's guard and scripted harness count when they run inside a demo module.
- `osf check REACH` converts each distinct record with `v8-to-istanbul` 9.3.0, which follows source maps of built
  files back to `src/`; builds emit source maps. A line counts as reached when any process ran it. With `OSF_BASE`, an
  added line in a module's `src/` or `bin/` that no process ran fails, and so does a new source file no process
  loaded, unless it holds only types. REACH runs in `make verify` after the tests.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Recorder preload plus v8-to-istanbul | Small files; works for TypeScript and built code; standard format | A preload in every module process |
| `NODE_V8_COVERAGE` | Built into Node | Writes every script of every process, test runner included: hundreds of megabytes per run |
| c8 | Ready-made CLI and reports | Wraps the process it starts; the testkit starts the processes itself, and REACH needs lines, not a report |
| Istanbul instrumentation (nyc) | Mature | Needs a transform of the module's code, which changes the artifact under test |

## Prior art

- `v8-to-istanbul` (ISC, istanbuljs, stable; used by c8 and others): adopted.
- c8 (ISC, active) and nyc (ISC, maintained): not adopted, see above.
- `@vitest/coverage-v8` (MIT, active): covers only the test process, not the module's own processes.

## Consequences

- A pull request that adds code no system test runs fails, which keeps the scenario-first loop honest.
- Code that only runs in a module's own child process without the testkit's `NODE_OPTIONS` does not count.
- Revisit if the per-record conversion gets slow: records could be merged by script before conversion.
