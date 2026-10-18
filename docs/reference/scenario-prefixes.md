---
covers: [modules/*/features/**, ports/*/features/**, e2e/features/**]
---

# Scenario ID prefixes

Every scenario ID is `SCN-<PREFIX>-NNN`. The SPEC check accepts only prefixes in this table. `make new-module`
adds a row.

| Prefix | Owner | Path |
| --- | --- | --- |
| CTR | contracts | `contracts/features/` |
| TK | testkit | `packages/testkit/features/` |
| FSPEC | factory-spec | `modules/factory-spec/features/` |
| RUN | runlog | `modules/runlog/features/` |
| PROOF | proof | `modules/proof/features/` |
| TRACE | spec-trace | `modules/spec-trace/features/` |
| SCORE | scorekit | `modules/scorekit/features/` |
| LEDGER | ledger | `modules/ledger/features/` |
| TASK | taskcapture | `modules/taskcapture/features/` |
| OBS | observer | `modules/observer/features/` |
| GATE | gatekeeper | `modules/gatekeeper/features/` |
| INTAKE | intake | `modules/intake/features/` |
| FORE | foreman | `modules/foreman/features/` |
| CONSOLE | console | `modules/console/features/` |
| HARNESS | harness port | `ports/harness/features/` |
| SANDBOX | sandbox port | `ports/sandbox/features/` |
| CHANNEL | channel port | `ports/channel/features/` |
| FORGE | forge port | `ports/forge/features/` |
| INFER | inference port | `ports/inference/features/` |
| SECRET | secrets port | `ports/secrets/features/` |
| DIST | distribution | `deploy/features/` |
| E2E | end-to-end smoke | `e2e/features/` |
| REPO | repository tooling and checks | `tools/features/` |

The factory-level requirements in `docs/vision/software-factory.feature` use `SCN-FACTORY-<AREA>-NNN`. They are
the source for module scenarios and are not checked by SPEC. A module scenario that realizes one names it with
`@realizes=SCN-FACTORY-...`.
