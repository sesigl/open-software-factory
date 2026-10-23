---
covers: [modules/*/features/**, ports/*/features/**, adapters/*/*/features/**, e2e/features/**]
---

# Scenario ID prefixes

Every scenario ID is `SCN-<PREFIX>-NNN`. The SPEC check accepts only prefixes in this table. `make new-module`
adds a row.

| Prefix | Owner | Path |
| --- | --- | --- |
| CTR | contracts | `contracts/features/` |
| TK | testkit | `packages/testkit/features/` |
| CLI | cli library | `packages/cli/features/` |
| SPECFILES | spec-files library | `packages/spec-files/features/` |
| HPROXY | harness-proxy library | `packages/harness-proxy/features/` |
| SEGRESS | sandbox-egress library | `packages/sandbox-egress/features/` |
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
| HACP | harness adapter acp | `adapters/harness/acp/features/` |
| HCLAUDE | harness adapter claude-code | `adapters/harness/claude-code/features/` |
| HCODEX | harness adapter codex | `adapters/harness/codex/features/` |
| HOPENCODE | harness adapter opencode | `adapters/harness/opencode/features/` |
| SANDBOX | sandbox port | `ports/sandbox/features/` |
| SDOCKER | sandbox adapter docker | `adapters/sandbox/docker/features/` |
| SKUBE | sandbox adapter kubernetes | `adapters/sandbox/kubernetes/features/` |
| CHANNEL | channel port | `ports/channel/features/` |
| FORGE | forge port | `ports/forge/features/` |
| INFER | inference port | `ports/inference/features/` |
| SECRET | secrets port | `ports/secrets/features/` |
| DIST | distribution | `deploy/features/` |
| E2E | end-to-end smoke | `e2e/features/` |
| REPO | repository tooling and checks | `tools/features/` |
| TEMPLATE | module template | `modules/_template/features/` |

The factory-level requirements in `docs/vision/software-factory.feature` use `SCN-FACTORY-<AREA>-NNN`. They are
the source for module scenarios and are not checked by SPEC. A module scenario that realizes one names it with
`@realizes=SCN-FACTORY-...`.
