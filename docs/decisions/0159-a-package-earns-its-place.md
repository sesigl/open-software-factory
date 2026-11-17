---
status: accepted; amended by 0175 (an adapter of a port is its own package; the size floor is for libraries)
topic: process
date: 2026-11-16
---

# 0159. A package earns its place

## Context

The owner decided in November 2026 that small packages merge, and that a rule keeps a new package from being created
for a small thing: "it must be a package that makes sense to create from different perspectives, including its size"
(`TODO.md`, wave 7).

Counted on 16 November 2026:

- 34 published npm packages hold about 37,000 lines in `src/` and `bin/`.
- 13 of them have fewer than 300 lines. The four harness adapters have 21 (`acp`), 57 (`claude-code`), 90
  (`opencode`) and 109 (`codex`) lines; `packages/postgres` has 34, `channel-kit` 152, `cli` 154, `spec-files` 175,
  `factory-source` 209 and `sandbox-egress` 266.
- Each published package carries a publish workflow, a release entry, a changelog, an `AGENTS.md` with its surface,
  layers, budget and quality limits, a README, an ADR, and a placeholder publish on npm that needs the maintainer's
  second factor (`skills/release-packages`). Ten of the 49 commits before wave 7 were releases or release repairs.

Two rules pushed shared lines into new packages:

- DUP failed every clone across units: "shared code moves into a package in `packages/` or into `contracts/`"
  (ADR 0037, ADR 0042). A clone of ten lines had nowhere to go but a package.
- ADR 0135 asks for one job per package. A narrow job read as a reason for one more small package.

Neither rule said when a new package is too small to be worth its cost.

## Decision

**A new published package needs all four of these.** The ADR of the package answers each under the heading
`## Why a package`.

1. **A job of its own** that a reader can say in one sentence (ADR 0135, unchanged).
2. **A reason to be installed or released alone.** One of:
   - a user or another repository installs it without the rest of the factory (a module, the testkit);
   - it implements a port as an adapter that a factory names in `factory.yaml`;
   - two units with a different release cadence need it, and neither can own it.
3. **A second consumer today** (for a library): two units import it in the same pull request that creates it. A
   consumer that is planned does not count.
4. **Enough substance to carry a release.** The floor is about **300 lines of source** for a library. An adapter of a
   port may be smaller, because the port asks for a command of its own; then prefer one package per port family with
   one command per product, as `TODO.md` T-89 plans for the harness adapters. The floor is a signal for the author
   and the reviewer, not a mechanical gate, and it does not apply to packages that exist today.

**When the bar is not met**, the code does not become a package:

- It goes into an existing library whose job it fits: `@opensoftware/cli` (commands, exit codes, input and output
  files), `@opensoftware/testkit` (what tests and fakes need), `@opensoftware/contracts` (shared formats and their
  readers), `@opensoftware/factory-source` (a factory's folder), `@opensoftware/spec-files` (feature files and JUnit
  reports). When the job of that library would need "and" for it, the code does not fit there.
- Or it stays in the one unit that uses it.
- Or, for a few lines, two units keep a copy. A little copying is better than a package for ten lines.

**DUP accepts a short clone across units.** A clone of at most 15 lines between two units counts toward the duplication
share of each unit, under the limit in its `AGENTS.md` ("Duplication: at most 3%"), as a clone inside the unit does. A
longer clone across units fails as before. Its message names the existing libraries first; a new package needs this
ADR's bar. A unit of 300 lines can hold 9 such lines; a small unit cannot hold any, so the pressure moves to merging
small units, not to creating more of them.

**The ADR check asks a new package for its reason.** A change that adds a published workspace package (a
`package.json` under `modules/`, `packages/` or `adapters/` that is not `private` and was not published at the base)
needs an accepted ADR that names the package, by its folder or its npm name, and has a non-empty `## Why a package`
section. An ADR with that heading left empty, or with the template's text, fails, as an empty Prior art does.

**Amends** ADR 0135 (one job is necessary, not sufficient) and ADR 0039 (a library holds code that two or more units
need and that clears this bar; a smaller piece joins an existing library).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A bar of four questions in the ADR, a size floor as a signal, the ADR check asks for the answer (chosen) | Cheap; review sees the reason; works for libraries and adapters alike | The answer can be weak; a person still judges it |
| A hard size gate in a check (fail every package under N lines) | Mechanical, nothing to argue | Fails 13 packages today; a line count says nothing about a port's command; a gate gets gamed with padding |
| Only prose in `AGENTS.md` | Nothing to build | Prose drifts and is not read when it matters; the owner asked for a rule that holds |
| DUP: no change | No new rule in the check | Keeps forcing a new package for every shared ten lines |
| DUP: an allow-list of accepted clones with a reason in the unit's `AGENTS.md` | Each copy is a visible decision | One more list to keep current; entries go stale when the clone changes (the old baseline had to fail gone entries) |
| DUP: `jscpd:ignore` comments in the source | jscpd supports them already | Hides the clone from every count, not visible in review as a rule |
| DUP: a short cross-unit clone counts under each unit's limit (chosen) | No list to keep; reuses the limit units already have; small units cannot absorb clones, so they merge | A threshold (15 lines) to choose; a unit near its limit can be pushed over by a copy |

## Prior art

Opened and read:

- **Turborepo** docs, bundled with `turbo` 2.11.7 (MIT, Vercel, active): "Creating an Internal Package", section "One
  'purpose' per package": a single purpose is "not a strict science or rule", and its example `@repo/ui` holds "all
  of your shared UI components". One purpose may be broad. Adopted: one job, but no package per small piece.
- **Nx** release groups (MIT, Nrwl, active, `nx.dev/docs/guides/nx-release/release-groups.md`): projects that release
  together go in one group with one version. Supports the reason "different release cadence": when two pieces
  release together anyway, a second package adds nothing.
- **Rule of three** (Don Roberts, popularised by Martin Fowler in *Refactoring*; Wikipedia, "Rule of three (computer
  programming)"): two copies can stay; extract at the third. Premature extraction "risks selecting a wrong
  abstraction". Adopted as the second consumer that exists today, and as the short clone DUP accepts.
- **Go Proverbs** (Rob Pike, Gopherfest 2015, `go-proverbs.github.io`): "A little copying is better than a little
  dependency." Adopted for clones of a few lines.

Could not open: the Nx page on project size (`nx.dev/docs/concepts/decisions/project-size`, 404 at every address
tried; Nx's `llms.txt` lists no page on project size). Nx's library types (feature, ui, data-access, util) were not
read for this ADR. No monorepo guide that we found gives a line count; the 300 lines are our own choice, from the
cost of a package listed above.

## Consequences

- A change that adds a package fails the ADR check until its ADR answers `## Why a package`. A change that moves code
  into an existing library needs no ADR for the package.
- Packages under the bar today are merged by `TODO.md` T-89 (one harness package) and T-90 (one channel package, and
  `postgres` in a shared library). Nothing else moves here. `cli`, `spec-files`, `factory-source` and
  `sandbox-egress` are also under the floor; whether they merge is a later decision.
- DUP lets a unit keep a copy of up to 15 lines from another unit while it stays under its limit. The copy is not
  listed anywhere; when it grows past 15 lines, DUP fails.
- Revisit when the factory implements this repository's issues (phase 3): if its agents still create small packages,
  the floor becomes a check.
