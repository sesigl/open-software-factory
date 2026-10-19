---
covers: [AGENTS.md, CLAUDE.md, skills/**]
---

# Bootstrapping: from local agents to a factory that builds itself

The factory is built with agents from day one, but it cannot build itself until enough of it exists.
Each phase has an exit criterion. When it is met, a person changes the phase line in `AGENTS.md` and the skills
listed for the next phase are added.

| Phase | Who builds | What runs | Exit criterion |
| --- | --- | --- | --- |
| 0 · Skeleton | People with a local coding agent | `make`, the testkit, the checks as scripts in `tools/checks/`, CI | `make verify` passes on `modules/_template` with one scenario, its system test and every check active |
| 1 · Local agents | Local agents, one module each; a person reviews every pull request | Wave 1 modules: factory-spec, runlog, proof. runlog records our own agent sessions from the first day | factory-spec, runlog and proof released as 0.1 and used in this repository |
| 2 · Eat our own tools | Local agents | Our released modules replace the scripts: spec-trace replaces `tools/checks/trace`, proof attaches evidence to our pull requests, scorekit scores our sessions, ledger shows our cost per pull request | CI of this repository uses only our released tools for TRACE, STEPS, PASS and evidence |
| 3 · Factory builds factory | The factory, on issues labeled `factory`; people approve specs and merges | foreman, gatekeeper, intake and the Docker sandbox run on this repository | Half of merged pull requests come from the factory for four weeks, with a revert rate no higher than human pull requests |
| 4 · Self-improvement | The factory and its observer | observer opens pull requests against our own `factory.yaml`; taskcapture benchmarks them | Two observer changes merged with a measured improvement |

## What changes per phase

- **Phase 1** adds nothing to the skills above.
- **Phase 2** adds the skill `use-own-tools`: how to replace a script in `tools/` with a released module
  without losing a check.
- **Phase 3** adds the skill `work-factory-ticket` for agents inside the factory, and narrows what local agents
  do: they handle work the factory cannot yet do and improve the factory itself.
- **Phase 4** adds the skill `review-observer-pr` for people.

## What never changes

The checks in `docs/quality/checks.md` apply in every phase and to every author, person, local agent or
factory. The factory gets no right that a local agent does not have.
