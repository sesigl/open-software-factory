---
covers: [AGENTS.md, CLAUDE.md, skills/**]
---

# Bootstrapping: from local agents to a factory that builds itself

The factory is built with agents from day one, but it cannot build itself until enough of it exists.
Each phase has an exit criterion. When it is met, a person changes the phase line in `AGENTS.md` and adds the skills
the next phase needs.

| Phase | Who builds | What runs | Exit criterion |
| --- | --- | --- | --- |
| 0 · Skeleton | People with a local coding agent | `make`, the testkit, the checks as scripts in `tools/checks/`, CI | `make verify` passes on `modules/_template` with one scenario, its system test and every check active |
| 1 · Local agents | Local agents, one module each; a person reviews every pull request | Wave 1 modules: factory-spec, runlog, proof. runlog records our own agent sessions from the first day, committed to `runs/` by every agent pull request (ADR 0027) until ADR 0153 dropped that rule | factory-spec, runlog and proof released as 0.1 and used in this repository |
| 2 · Eat our own tools | Local agents | Our modules replace the scripts: spec-trace replaces `tools/checks/trace`, proof attaches evidence to our pull requests, scorekit scores our sessions, ledger shows our cost per pull request | CI of this repository uses only our own tools, built from the commit (ADR 0083), for TRACE, STEPS, PASS and evidence |
| 3 · Factory builds factory | The factory, on issues labeled `factory`; people approve specs and merges | The Compose profile on the owner's machine runs the factory of `deploy/dogfood/factory/` on this repository's issues, with the gate on the pull request (ADR 0080). Before it: stage E of wave 7 in `TODO.md` | Half of merged pull requests come from the factory for four weeks, with a revert rate no higher than human pull requests |
| 4 · Self-improvement | The factory and its observer | observer opens pull requests against our own `factory.yaml`; taskcapture benchmarks them | Two observer changes merged with a measured improvement |

Phase 3's two numbers, the factory's share of merged pull requests and the revert rate of the factory's pull requests
next to people's, are printed by `ledger report --since <day> --until <day>` for the four weeks, in `origin` of
`report.json` (a pull request is the factory's when its head branch starts with `osf/`, `observer/` or `factory/`).

## What changes per phase

The ten skills in `skills/` serve every phase; none is tied to one phase yet.

- **Phases 1 and 2** added no skill of their own.
- **Phase 3**, planned: a skill for agents inside the factory that work a `factory` issue, and a narrower job for
  local agents: work the factory cannot yet do, and the factory itself. The factory's agents run in sandboxes of the
  image `dogfood-agent`, which has no Docker: they check their change with `make check-fast`, and the check `verify`
  of the pull request runs the suites (ADR 0164).
- **Phase 4**, planned: a skill for people who review an observer pull request.

## What never changes

The checks in `docs/quality/checks.md` apply in every phase and to every author, person, local agent or
factory. The factory gets no right that a local agent does not have.
