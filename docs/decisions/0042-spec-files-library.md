---
status: accepted
date: 2026-10-21
---

# 0042. The library @opensoftware/spec-files reads feature files and JUnit reports

## Context

Three units read the files that specify and prove the factory. spec-trace (ADR 0030, ADR 0031) reads feature files
and JUnit reports for SPEC, TRACE, STEPS and PASS. The repository checks in `tools/` read the same files for REACH,
BUDGET, FLAKE, ASSERT and the generated scenario tables. proof (ADR 0028) reads JUnit reports into evidence bundles.
Each had its own copy of the Gherkin walk (tags, rules, Background steps, `And` keywords) and of the JUnit walk
(suites, test cases, properties, status). The testkit and `tools/` each had a copy of the rule that names the
environment variables a module's README documents. DUP listed five of these copies in its baseline (ADR 0037).

The testkit is the base of every test, including the tests of every library. It cannot depend on a library: that
dependency would be a cycle, and Turbo refuses a cycle in the package graph.

## Decision

- **New library `packages/spec-files`**, published as `@opensoftware/spec-files` (prefix `SCN-SPECFILES`, layout
  of ADR 0039). Layers: `api` (`src/index.ts`) → `readers` (`src/gherkin.ts`, `src/junit.ts`).
- **Feature files:** `parseFeature(file, text)` gives each scenario with its IDs, statuses, inherited tags, steps
  and the rows of its Examples tables, or an error with the line where the file does not parse. `statusOf` and
  `tagValues` read tags. It uses the official parser `@cucumber/gherkin`.
- **JUnit reports:** `parseJUnit(xml)` gives each test case with its suite, class name, properties, status,
  reruns and time. `readJUnitFolder(dir)` reads every `.xml` file of a folder. `scenarioIdOf(test, id)` finds the
  scenario a test case proves: the property `scenario`, else the ID in its name, else in its class name. It uses
  `fast-xml-parser`.
- spec-trace, proof and `tools/` use the library and drop their direct dependencies on `@cucumber/gherkin`,
  `@cucumber/messages` and `fast-xml-parser`. What a scenario or a result means for a check stays with the check.
- **README rules stay in the testkit**, which applies them when a test starts a module. The testkit exports them as
  `@opensoftware/testkit/readme` (`documentedEnv`, `readmeSection`) for programs that check a README without running
  a test. The BOUNDARY-ENV check in `tools/` uses that export, so `tools/` depends on the testkit at run time.
  ASSERT counts what the testkit's subpath exports return as a value from the system under test in the testkit's
  own tests, as it does for a package's main export (SCN-REPO-061).
- **No baseline.** With these five clones gone, `docs/quality/duplication-baseline.json` is empty. DUP drops the
  baseline and fails every clone across units, except a clone of `modules/_template`. SCN-REPO-046 is deprecated.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| One library for feature files and JUnit reports | Both are read together by every user; one place to find them | Two formats in one package |
| A library per format | Smallest packages | Two more releases, ADRs and workflows for about 150 lines |
| README rules in the library too | All file reading in one place | The testkit would depend on a library its tests need: a cycle |
| README rules as `@opensoftware/testkit/readme` | The testkit owns the rules it enforces; no cycle | The testkit gets a second entry point |
| tools/ uses spec-trace as a library | No new package | ISOLATION and ADR 0037: a module is not a library; spec-trace would get a second surface |

## Prior art

- `@cucumber/gherkin` (42.0.1, MIT, Cucumber, active): adopted, as before in spec-trace and `tools/`.
- `@cucumber/gherkin-utils` (12.0.2, MIT, active): pretty-prints and walks the Gherkin AST, but has no flat
  scenario model with inherited tags and Background steps; not adopted.
- `fast-xml-parser` (5.11.2, MIT, active): adopted, as before.
- `junit2json` (4.0.0, MIT, released July 2026): turns JUnit XML into JSON objects, but keeps the raw element
  shape and does not count reruns or read properties as a map; we would still map its output. Not adopted.
- `junit-xml-parser` (0.0.3, no license, last release 2022): not maintained.

## Consequences

- A new check or module that reads scenarios or test results starts from the library, with the same rules as
  SPEC and PASS.
- A change to how a feature file is read changes spec-trace and the checks together, and both run their scenarios.
- Revisit when a unit needs another report format, such as Playwright JSON (proof reads it on its own today).
