---
status: accepted
date: 2026-10-23
---

# 0051. System test files share Vitest workers

## Context

Every scenario is its own test file. By default Vitest isolates each file: it starts a fresh worker for it, and
the worker imports `@opensoftware/testkit` again. That import takes about 0.7 s, against 0.04 s for a bare Node
start, mostly testcontainers, the MCP client and the ACP SDK. Ledger's Vitest report showed 43 s of import time
against 72 s of test time.

ADR 0049 asked to measure before adding stand-ins. The measurement showed that containers are a small share: about
28 of 631 scenarios start one. The import per file was the largest single cost. On a 4-core machine like a GitHub
runner, the 13 suites took 476 s one after the other.

The testkit keeps the state of a scenario in the scenario: its own temporary workspace, its own fakes and its own
module processes, all closed when the scenario ends. No system test changes `process.env`, the working directory
or a global. So a worker can run many scenario files one after the other.

## Decision

- Every `vitest.config.ts` (modules, packages, tools, contracts, adapters and `modules/_template`) sets
  `isolate: false`. A worker imports the testkit once and runs scenario files one after the other.
- A system test keeps its state inside its scenario, through the testkit. It does not change `process.env`, the
  working directory or a global of the test process. What a module does runs in the module's own process and is
  not affected.
- Parallelism stays as it is: Vitest's default number of workers. More workers did not help on 4 cores, because
  the suites are CPU-bound.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Keep isolation (default) | A file cannot see what an earlier file left behind | 0.7 s of imports per scenario; 476 s for all suites |
| `isolate: false` | 476 s to 291 s (-39 %) with all 631 scenarios passing; mutation reruns each suite per mutant and gains the same | A test that changes the test process leaks into later files of its worker |
| Lazy imports in the testkit index | Keeps isolation | Saves about 0.5 s of the 0.7 s per file, and more code in the testkit |
| More workers (`--maxWorkers=8`) | No code change | No gain on 4 cores: ledger 43.7 s before and after |

## Prior art

Vitest's own option (`test.isolate`, MIT, very active), documented as the way to speed up suites whose files do
not rely on a clean environment. No new dependency.

## Consequences

- Measured on 4 cores, one run each, `isolate: false` against the default:

  | Suite | Before (s) | After (s) |
  | --- | --- | --- |
  | testkit | 78.4 | 59.1 |
  | cli, spec-files, scorekit, spec-trace, taskcapture | 99.3 | 48.9 |
  | gatekeeper | 47.6 | 26.9 |
  | ledger | 48.8 | 27.7 |
  | proof | 46.6 | 35.3 |
  | runlog | 46.5 | 22.3 |
  | tools | 43.6 | 26.7 |
  | factory-spec | 37.5 | 24.6 |
  | observer | 27.6 | 19.3 |

- Times per scenario barely change, so the budgets of BUDGET stay valid.
- A test that changes the test process now affects the files after it in the same worker. If such a test is ever
  needed, its package sets `isolate: true` again, with a reason in its `AGENTS.md`.
- The next gains are cheaper coverage for REACH in module processes, lazy imports in module CLIs (proof loads
  Playwright on every start) and, for MUTATION, running only the scenarios that reach a mutated line.
