---
status: accepted
date: 2026-10-20
---

# 0030. spec-trace checks scenario traceability for any repository

## Context

TODO item T-06 asks for spec-trace: requirements traceability for any repository with feature files. Today the
checks SPEC, TRACE, STEPS and PASS are scripts in `tools/checks/` (T-00) that only this repository can run. Phase 2
of `docs/explanation/bootstrapping.md` replaces them with a released module. The module needs the same rules, but
without this repository's layout built in: the ID pattern, the prefixes, the folders and the test function must be
settings.

This change is the first slice of T-06: the CLI `check`, `report` and `next-id`, its configuration, and the npm
release.

## Decision

- **New optional module `modules/spec-trace`** (TypeScript, prefix `SCN-TRACE`), published as
  `@opensoftware/spec-trace`. Layers: `entry` (`src/cli.ts`) → `commands` → `adapters` → `domain`. `domain` holds the
  rules, the configuration, the report and the next ID, without I/O; `adapters` read the files of the repository,
  parse feature files, read test files as TypeScript ASTs, read JUnit XML and proof bundles; `commands` join them.
- **Inputs.** spec-trace works on the repository in the current folder. It reads every file below it except
  `node_modules` and hidden folders. Feature files are parsed with the official Gherkin parser. A test is a call of
  the scenario function (default `scenario`) whose first argument is the scenario ID; its steps are the calls of
  `given`, `when` and `then` inside it. Only string literals count. A JUnit test case belongs to the scenario in its
  property `scenario`, or else the first ID in its name or class name.
- **`spec-trace check [--only <rules>]`** runs SPEC, TRACE, STEPS and PASS with the same cases and messages as the
  scripts in `tools/checks/`. It prints `RULE file:line message` per finding and `RULE ok` or `RULE failed: N` per
  rule, and exits 1 on any finding. A scenario outline is one scenario with one test; every JUnit result of its
  examples counts for it.
- **`spec-trace report [--out <file>] [--evidence <bundle>]...`** writes one JSON file (default
  `$OUTPUT/spec-trace.json`): each scenario with its status, tests, result (`null` without JUnit reports), number of
  examples and number of artifacts in the given proof bundles (checked against the `evidence-bundle` contract), the
  totals, and the findings of the rules. The report is the module's own output, not a contract, until a second
  module reads it.
- **`spec-trace next-id <prefix>`** prints the number after the highest ID of the prefix, deprecated scenarios
  included. A new prefix starts at 1 with the width of the pattern's `\d{N}`.
- **Configuration.** An optional `spec-trace.json` in the current folder, or the file named by `--config`:
  `features` and `tests` (globs), `junit` (folder), `id` (regular expression whose first group is the prefix),
  `function`, `prefixes` (an object of prefix and folder, or a Markdown table file like
  `docs/reference/scenario-prefixes.md`), `testFolder` (the test of a scenario in `<root>/features/` lives in
  `<root>/<testFolder>/`) and `conformance` (`tag`, `ports` with `{port}`, `adapters` with `{port}` and
  `{adapter}`): each adapter of a port needs one test per implemented scenario with the tag. An unknown key or a
  wrong type exits 2.
- **Release.** release-please with the tag `spec-trace-v<version>`, first version `0.1.0`, and
  `.github/workflows/publish-spec-trace.yml`, like proof (ADR 0028).
- **Later slices of T-06:** the GitHub Action, the base and head diff in the report, and the dogfood: this
  repository's CI runs spec-trace with a root `spec-trace.json` instead of `tools/checks/` for SPEC, TRACE, STEPS
  and PASS.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A module with the rules ported from `tools/checks/` | Same cases and messages, so the dogfood can swap one for the other | Two copies of the rules until the dogfood slice deletes the scripts |
| Make `tools/checks/` a package | No second copy | The scripts know this repository's layout; tools must not be a product |
| Settings in `spec-trace.json` | One file, read by the CLI and the later Action | One more file in a user's repository; all keys are optional |
| Settings as CLI flags only | Nothing to add to a repository | Long command lines; the Action and local runs drift apart |
| ts-morph for test ASTs | The TypeScript compiler's own parser; same results as the bootstrap checks | Large package; only TypeScript and JavaScript tests |
| Regular expressions over test files | Fast, any language | Cannot tell a literal from a variable or a call from a comment |

## Prior art

- OpenFastTrace (GPL-3.0, itsallcode, active, releases into 2026): traces requirement IDs through specifications,
  code and tests. Java, its own ID syntax in comments and Markdown, no Gherkin steps, no JUnit results. Not adopted:
  another language and license, and it does not check step text.
- gherkin-lint (ISC, low activity) and its forks gplint (MIT, active) and gherkin-lint-ts: lint feature files, with
  tag rules such as `allowed-tags` and `no-duplicate-tags`. They see only feature files, not tests or results.
  Not adopted: the four rules need the tests and the results.
- Cucumber (MIT, active) and Serenity BDD (Apache-2.0, active): run scenarios and write living documentation.
  They execute steps through step definitions; they do not check that one system test names each scenario.
- `@cucumber/gherkin` and `@cucumber/messages` (MIT, Cucumber, active): the official parser. Adopted, the same
  version as `tools/`.
- ts-morph (MIT, active), fast-xml-parser (MIT, active) and picomatch (MIT, active): the AST reader, the JUnit
  reader and the globs of `tools/`. Adopted, the same versions.

## Consequences

- Any repository with feature files and `scenario(...)` tests can run the four rules with `npx`.
- Until the dogfood slice, the rules exist twice: in `tools/checks/` and in spec-trace. A fix to one goes to both.
- Tests in another language or style (`it("SCN-... ")`) are not traced yet. Revisit when a user asks.
