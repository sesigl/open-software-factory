---
status: accepted
date: 2026-11-08
---

# 0093. A new PGlite database starts from PGlite's empty data folder, not from initdb

## Context

intake's embedded database (ADR 0063) and the testkit's `fakes.postgres()` (ADR 0049) run PGlite. For a new
database, PGlite runs PostgreSQL's initdb in a second PGlite instance and loads a dump of it. Measured on a laptop:

| Start | Wall time | CPU time |
| --- | --- | --- |
| New folder, initdb | 0.85 s | 1.9 s |
| New folder, from an empty data folder | 0.38 s | 0.6 s |
| Folder that holds a database | 0.11 s | 0.2 s |

Compiling PGlite's WebAssembly costs about 30 ms, so the time is initdb's own work. Most intake scenarios start
`intake serve` in a new data folder, so the suite paid initdb about 45 times. On main its sum of times was 197 to
320 seconds on different CI runners against a budget of 300 (BUDGET): every scenario was slower by the same factor
on a slow runner, because the scenarios run side by side and initdb is CPU time.

The testkit avoided initdb with its own copy of an empty data folder in the temporary folder. intake cannot use the
testkit at run time, and a library that both use cannot be tested with the testkit, which would depend on it: turbo
refuses the cycle.

## Decision

- intake and the testkit depend on `@electric-sql/pglite-prepopulatedfs`, the empty data folder that ElectricSQL
  builds for each PGlite release, and start a new database with PGlite's own option `loadDataDir: await dataDir()`.
  - intake passes it only for a folder without `PG_VERSION`: PGlite refuses it for a folder that holds a database.
  - The testkit's own copy in the temporary folder goes away.
- The package pins PGlite exactly. Both packages keep `@electric-sql/pglite` and `@electric-sql/pglite-prepopulatedfs`
  at the same version and change them together. A data folder of another version fails every scenario that starts a
  database, so a mismatch does not pass `verify`.
- The mutants that only remove the empty data folder are equivalent: PGlite then runs initdb, and the result is the
  same database, later. intake's lines carry `Stryker disable` comments with that reason
  (`skills/fix-mutation-and-duplication`).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| PGlite's prepopulated data folder (chosen) | Built and versioned by PGlite's makers; no code of ours; no state outside the data folder | One more dependency of 4.6 MB, which must match PGlite's version |
| A library `@opensoftware/pglite` with a copy in the temporary folder | Proven by its own scenarios | The testkit depends on it while its tests depend on the testkit: a cycle that turbo refuses; its tests against a released testkit only hide the cycle |
| A copy in the temporary folder in intake, like the testkit's | Small | The same code twice; a file outside the data folder that the server must check for its owner; most mutants equivalent |
| intake's build writes an empty data folder into `dist/` | No new dependency | Does what the prepopulated package already does; a build step in two packages; 4.5 MB in each of our npm packages |
| Raise intake's budget | No change | The suite stays slow; the cause stays |

## Prior art

- `@electric-sql/pglite-prepopulatedfs` 0.5.11 (Apache-2.0, ElectricSQL, released with each PGlite version): adopted.
  Its README names this case: several tests, each with its own PGlite instance.
- PostgreSQL's own regression tests copy an initialized data folder instead of running initdb again (commit
  252dcb32, "Use template data directory in tests"): the same method.
- `dumpDataDir` and `loadDataDir` as a clone of a database (electric-sql/pglite issue 416): what the testkit did
  before; replaced by the package.

## Consequences

- A new intake data folder, in a scenario or at a user's first start, costs a third of the CPU time.
- The testkit has no file of its own in the temporary folder any more.
- A PGlite update changes two dependencies in intake and in the testkit. Revisit when PGlite itself starts a new
  database without initdb.
