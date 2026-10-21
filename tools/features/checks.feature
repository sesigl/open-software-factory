@module=tools @owner=maintainers
Feature: Repository checks
  The checks of docs/quality/checks.md run as "osf check" in a repository. Each failure prints its check ID and
  the file and line to fix. Checks that compare against a base read the Git ref from OSF_BASE. SPEC, TRACE, STEPS
  and PASS moved to the module spec-trace (ADR 0031); its scenarios SCN-TRACE-001 to -049 cover them.

  @id=SCN-REPO-001 @status=deprecated
  Scenario: A module created from the template passes the fast checks
    Given a repository with the module template and an accepted ADR for the module "demo"
    And the developer ran "osf new-module demo"
    When the developer runs "osf check"
    Then the command exits with code 0
    And the output contains "SPEC ok"

  @id=SCN-REPO-002 @status=deprecated
  Scenario: SPEC rejects a duplicate scenario ID
    Given a repository with two scenarios with the ID "SCN-DEMO-001"
    When the developer runs "osf check SPEC"
    Then the command exits with code 1
    And the output contains "SPEC modules/demo/features/b.feature:5 duplicate ID SCN-DEMO-001"

  @id=SCN-REPO-003 @status=deprecated
  Scenario: TRACE rejects an implemented scenario without a system test
    Given a repository with the implemented scenario "SCN-DEMO-001" and no system test
    When the developer runs "osf check TRACE"
    Then the command exits with code 1
    And the output contains "TRACE modules/demo/features/a.feature:5 SCN-DEMO-001 is implemented but has no system test"

  @id=SCN-REPO-004 @status=deprecated
  Scenario: STEPS rejects a label that differs from the step
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test labels the step 'When the user runs "demo run"' as "the user runs demo"
    When the developer runs "osf check STEPS"
    Then the command exits with code 1
    And the output contains "STEPS modules/demo/system-tests/SCN-DEMO-001.test.ts:7"
    And the output contains "differs from the step"

  @id=SCN-REPO-005 @status=deprecated
  Scenario: PASS rejects a skipped test
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And a JUnit report in which the test of "SCN-DEMO-001" was skipped
    When the developer runs "osf check PASS"
    Then the command exits with code 1
    And the output contains "PASS modules/demo/features/a.feature:5 SCN-DEMO-001 was skipped"

  @id=SCN-REPO-006 @status=implemented
  Scenario: BOUNDARY-STATIC rejects an import from src/
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test imports "../src/run.ts"
    When the developer runs "osf check BOUNDARY-STATIC"
    Then the command exits with code 1
    And the output contains "BOUNDARY-STATIC modules/demo/system-tests/SCN-DEMO-001.test.ts:2"

  @id=SCN-REPO-056 @status=implemented
  Scenario: BOUNDARY-STATIC accepts a library's system test that imports the library
    Given a repository with the library "packages/money" named "@opensoftware/money" and the implemented scenario "SCN-MONEY-001"
    And its system test imports "@opensoftware/money"
    When the developer runs "osf check BOUNDARY-STATIC"
    Then the command exits with code 0
    And the output contains "BOUNDARY-STATIC ok"

  @id=SCN-REPO-057 @status=implemented
  Scenario: BOUNDARY-STATIC rejects a library's system test that imports the library's src/
    Given a repository with the library "packages/money" named "@opensoftware/money" and the implemented scenario "SCN-MONEY-001"
    And its system test imports "../src/index.ts"
    When the developer runs "osf check BOUNDARY-STATIC"
    Then the command exits with code 1
    And the output contains "BOUNDARY-STATIC packages/money/system-tests/SCN-MONEY-001.test.ts:2"

  @id=SCN-REPO-007 @status=deprecated
  Scenario: SPECGUARD rejects a changed implemented step without approval
    Given a base commit with the implemented scenario "SCN-DEMO-001"
    And a change to the text of its "Then" step
    And no approval from a code owner
    When the developer runs "osf check SPECGUARD" against the base commit
    Then the command exits with code 1
    And the output contains "SPECGUARD modules/demo/features/a.feature:5 SCN-DEMO-001 changed its steps"
    And the output contains "@maintainer"

  @id=SCN-REPO-008 @status=implemented
  Scenario: DOCS-AFFECTED lists a doc whose covers path changed
    Given a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/src/**"
    And a change to "modules/demo/src/run.ts"
    When the developer runs "osf docs-affected" against the base commit
    Then the command exits with code 1
    And the output contains "DOCS-AFFECTED docs/how-to/demo.md:1"

  @id=SCN-REPO-009 @status=implemented
  Scenario: ISOLATION rejects a module that imports another module
    Given a repository with the modules "demo" and "other"
    And "modules/demo/src/run.ts" imports "../../other/src/index.ts"
    When the developer runs "osf check ISOLATION"
    Then the command exits with code 1
    And the output contains "ISOLATION modules/demo/src/run.ts:1"

  @id=SCN-REPO-054 @status=implemented
  Scenario: ISOLATION accepts a module that depends on a library in packages
    Given a repository with the module "demo" and the library "packages/money" named "@opensoftware/money"
    And "modules/demo/package.json" depends on "@opensoftware/money"
    When the developer runs "osf check ISOLATION"
    Then the command exits with code 0
    And the output contains "ISOLATION ok"

  @id=SCN-REPO-010 @status=implemented
  Scenario: BOUNDARY-ENV rejects an environment variable that the README does not document
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test passes the environment variable "DEMO_SECRET_MODE" to the module
    When the developer runs "osf check BOUNDARY-ENV"
    Then the command exits with code 1
    And the output contains "BOUNDARY-ENV modules/demo/system-tests/SCN-DEMO-001.test.ts"
    And the output contains "DEMO_SECRET_MODE"

  @id=SCN-REPO-011 @status=implemented
  Scenario: NOSKIP rejects a skipped test
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test file contains "test.skip"
    When the developer runs "osf check NOSKIP"
    Then the command exits with code 1
    And the output contains "NOSKIP modules/demo/system-tests/SCN-DEMO-001.test.ts"

  @id=SCN-REPO-012 @status=implemented
  Scenario: ASSERT rejects a then step that asserts only on a value the test created
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test's then step asserts only on a constant
    When the developer runs "osf check ASSERT"
    Then the command exits with code 1
    And the output contains "ASSERT modules/demo/system-tests/SCN-DEMO-001.test.ts"

  @id=SCN-REPO-013 @status=implemented
  Scenario: FLAKE rejects a test that passed only on retry
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And a JUnit report in which the test of "SCN-DEMO-001" passed after 1 retry
    When the developer runs "osf check FLAKE"
    Then the command exits with code 1
    And the output contains "FLAKE modules/demo/features/a.feature:5 SCN-DEMO-001 passed only after 1 retry"

  @id=SCN-REPO-014 @status=implemented
  Scenario: BUDGET rejects system tests that take longer than the module budget
    Given a repository whose module "demo" has a budget of 10 seconds
    And a JUnit report in which the system tests of "demo" took 12.5 seconds
    When the developer runs "osf check BUDGET"
    Then the command exits with code 1
    And the output contains "BUDGET modules/demo/AGENTS.md"
    And the output contains "12.5 s"

  @id=SCN-REPO-015 @status=implemented
  Scenario: CONTRACT rejects a removed schema property without a major version
    Given a base commit with the schema "contracts/demo/demo.schema.json" at version "1.2.0"
    And a change that removes its property "name" and sets the version "1.3.0"
    When the developer runs "osf check CONTRACT" against the base commit
    Then the command exits with code 1
    And the output contains "CONTRACT contracts/demo/demo.schema.json"
    And the output contains "removed property name"

  @id=SCN-REPO-016 @status=implemented
  Scenario: DOCS-GEN rejects a generated README section that is out of date
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the module README lists no scenarios under its generated marker
    When the developer runs "osf check DOCS-GEN"
    Then the command exits with code 1
    And the output contains "DOCS-GEN modules/demo/README.md"

  @id=SCN-REPO-017 @status=implemented
  Scenario: DOCS-LINKS rejects a link to a missing file
    Given a repository with the doc "docs/guide.md" that links "missing.md"
    When the developer runs "osf check DOCS-LINKS"
    Then the command exits with code 1
    And the output contains "DOCS-LINKS docs/guide.md:3"

  @id=SCN-REPO-018 @status=implemented
  Scenario: ADR rejects a new dependency without an accepted ADR
    Given a base commit without dependencies
    And a change that adds the dependency "left-pad" to "modules/demo/package.json"
    And the only ADR that names "left-pad" is proposed
    When the developer runs "osf check ADR" against the base commit
    Then the command exits with code 1
    And the output contains "ADR modules/demo/package.json"
    And the output contains "left-pad"

  @id=SCN-REPO-019 @status=implemented
  Scenario: BOUNDARY-STATIC names the line of a Node built-in import in a system test
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test imports "node:fs"
    When the developer runs "osf check BOUNDARY-STATIC"
    Then the command exits with code 1
    And the output contains 'BOUNDARY-STATIC modules/demo/system-tests/SCN-DEMO-001.test.ts:2 import "node:fs"'

  @id=SCN-REPO-020 @status=deprecated
  Scenario: Running every check without a base fails and names the skipped comparisons
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And a JUnit report in which the test of "SCN-DEMO-001" passed
    When the developer runs "osf check --all" without OSF_BASE
    Then the command exits with code 1
    And the output contains "SPECGUARD skipped: OSF_BASE is not set"
    And the output contains "DOCS-AFFECTED skipped: OSF_BASE is not set"

  @id=SCN-REPO-023 @status=implemented
  Scenario: CONTRACT compares with the last contracts release and checks the values of maps
    Given the release tag "contracts-v1.2.0" on a commit whose schema "contracts/demo/demo.schema.json" gives every agent the property "prompt"
    And a later base commit that removes the property "prompt" and sets the version "1.3.0"
    When the developer runs "osf check CONTRACT" against the later base commit
    Then the command exits with code 1
    And the output contains "CONTRACT contracts/demo/demo.schema.json"
    And the output contains "since contracts-v1.2.0"
    And the output contains "removed property agents.*.prompt"

  @id=SCN-REPO-024 @status=implemented
  Scenario: CONTRACT checks the formats of fixture values
    Given the schema "contracts/demo/demo.schema.json" whose property "link" has the format "uri"
    And the invalid fixture "contracts/demo/fixtures/invalid/relative-link.json" with the link "not a uri"
    When the developer runs "osf check CONTRACT" without OSF_BASE
    Then the command exits with code 0
    And the output does not contain "unknown format"

  @id=SCN-REPO-025 @status=implemented @replaces=SCN-REPO-020
  Scenario: Running every check without a base fails and names the skipped comparisons
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And a JUnit report in which the test of "SCN-DEMO-001" passed
    When the developer runs "osf check --all" without OSF_BASE
    Then the command exits with code 1
    And the output contains "DOCS-AFFECTED skipped: OSF_BASE is not set"
    And the output contains "check --all needs OSF_BASE"

  @id=SCN-REPO-026 @status=implemented
  Scenario: ARCH rejects an import from a layer above
    Given a module "demo" whose architecture.json lists the layer "cli" with "src/cli/" above the layer "domain" with "src/domain/"
    And "modules/demo/src/domain/rules.ts" imports "../cli/main.ts"
    When the developer runs "osf check ARCH"
    Then the command exits with code 1
    And the output contains "ARCH modules/demo/src/domain/rules.ts:1 layer domain imports ../cli/main.ts from layer cli above it"

  @id=SCN-REPO-027 @status=implemented
  Scenario: ARCH rejects a source file outside every declared layer
    Given a module "demo" whose architecture.json lists the layer "cli" with "src/cli/" above the layer "domain" with "src/domain/"
    And the file "modules/demo/src/util.ts"
    When the developer runs "osf check ARCH"
    Then the command exits with code 1
    And the output contains "ARCH modules/demo/src/util.ts:1 is in no layer of modules/demo/architecture.json"

  @id=SCN-REPO-028 @status=implemented
  Scenario: ARCH rejects a module without architecture.json
    Given a module "demo" with the file "modules/demo/src/index.ts" and no architecture.json
    When the developer runs "osf check ARCH"
    Then the command exits with code 1
    And the output contains "ARCH modules/demo/package.json:1 has no architecture.json"

  @id=SCN-REPO-029 @status=implemented
  Scenario: ISOLATION finds an import in a file that another file of the module imports
    Given a repository with the modules "demo" and "other"
    And "modules/demo/src/a.ts" imports "./run.ts"
    And "modules/demo/src/run.ts" imports "../../other/src/index.ts"
    When the developer runs "osf check ISOLATION"
    Then the command exits with code 1
    And the output contains "ISOLATION modules/demo/src/run.ts:1"

  @id=SCN-REPO-030 @status=deprecated
  Scenario: TRACE rejects an adapter without a system test for a conformance scenario of its port
    Given a port "forge" with the implemented @conformance scenario "SCN-FORGE-001" and the adapters "a" and "b"
    And only the adapter "a" has a system test for "SCN-FORGE-001"
    When the developer runs "osf check TRACE"
    Then the command exits with code 1
    And the output contains "TRACE ports/forge/features/a.feature:5 SCN-FORGE-001 needs exactly one system test in adapters/forge/b/system-tests/, has 0"

  @id=SCN-REPO-031 @status=implemented
  Scenario: REACH rejects added lines that no system test reaches
    Given a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs
    And a change that adds the function "unused", whose body is lines 5 and 6
    And a coverage report in which the system tests ran only "used"
    When the developer runs "osf check REACH" against the base commit
    Then the command exits with code 1
    And the output contains "REACH modules/demo/src/run.ts:5 no system test reaches lines 5 to 6"

  @id=SCN-REPO-032 @status=implemented
  Scenario: REACH rejects a new source file that no system test loads and skips a file of types only
    Given a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs
    And a change that adds "modules/demo/src/extra.ts" with a function and "modules/demo/src/types.ts" with an interface
    And a coverage report in which the system tests ran only "used"
    When the developer runs "osf check REACH" against the base commit
    Then the command exits with code 1
    And the output contains "REACH modules/demo/src/extra.ts:1 no system test loads this file"
    And the output does not contain "types.ts"

  @id=SCN-REPO-033 @status=implemented
  Scenario: REACH accepts a change whose lines a system test reaches
    Given a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs
    And a change to the body of "used"
    And a coverage report in which the system tests ran only "used"
    When the developer runs "osf check REACH" against the base commit
    Then the command exits with code 0
    And the output contains "REACH ok"

  @id=SCN-REPO-034 @status=implemented
  Scenario: REACH asks for a test run when a changed module has no coverage
    Given a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs
    And a change to the body of "used"
    And no coverage report
    When the developer runs "osf check REACH" against the base commit
    Then the command exits with code 1
    And the output contains "REACH modules/demo/package.json:1 no coverage in reports/coverage/ for this module: run its system tests first"

  @id=SCN-REPO-035 @status=implemented
  Scenario: make docs generates the Commands section from the CLI help
    Given a module whose "src/cli.ts --help" lists the command "demo run" as "Run the demo."
    And its README has the marker "generated by make docs from src/cli.ts --help" under "## Commands"
    When the developer runs "osf docs"
    Then the command exits with code 0
    And the module README has the row "| `demo run` | Run the demo. |"

  @id=SCN-REPO-036 @status=implemented
  Scenario: DOCS-AFFECTED ignores the files of a release
    Given a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/**"
    And a change that adds "modules/demo/CHANGELOG.md" and sets "version" in "modules/demo/package.json" to "0.2.0"
    When the developer runs "osf docs-affected" against the base commit
    Then the command exits with code 0

  @id=SCN-REPO-037 @status=implemented
  Scenario: DOCS-AFFECTED lists a doc when package.json changes more than its version
    Given a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/**"
    And a change that sets "version" to "0.2.0" and adds the dependency "yaml" in "modules/demo/package.json"
    When the developer runs "osf docs-affected" against the base commit
    Then the command exits with code 1
    And the output contains "DOCS-AFFECTED docs/how-to/demo.md:1"

  @id=SCN-REPO-055 @status=implemented
  Scenario: DOCS-AFFECTED ignores the version that a release writes into an extra file
    Given a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/**"
    And a release-please config whose package "modules/demo" lists the extra file "openapi.json" with the jsonpath "$.info.version"
    And a change that sets "info.version" in "modules/demo/openapi.json" to "0.2.0"
    When the developer runs "osf docs-affected" against the base commit
    Then the command exits with code 0

  @id=SCN-REPO-038 @status=implemented
  Scenario: RUNS rejects a run record with prompt content
    Given a run record "runs/run-1.jsonl" whose chat span has the attribute "gen_ai.input.messages"
    When the developer runs "osf check RUNS"
    Then the command exits with code 1
    And the output contains "RUNS runs/run-1.jsonl:1 has content gen_ai.input.messages"

  @id=SCN-REPO-039 @status=implemented
  Scenario: RUNS rejects a run record that does not match the run-record contract
    Given a run record "runs/run-1.jsonl" without the resource attribute "osf.run.id"
    When the developer runs "osf check RUNS"
    Then the command exits with code 1
    And the output contains "RUNS runs/run-1.jsonl:1 does not match the run-record contract"
    And the output contains "osf.run.id"

  @id=SCN-REPO-040 @status=implemented
  Scenario: RUNS rejects agent commits without a run record
    Given a base commit
    And a later commit with the trailer "Co-Authored-By: Claude <noreply@anthropic.com>" that changes no file in "runs/"
    When the developer runs "osf check RUNS" against the base commit
    Then the command exits with code 1
    And the output contains "no run record in runs/ changed: run make run-record and commit runs/"

  @id=SCN-REPO-041 @status=implemented
  Scenario: RUNS accepts agent commits that add a run record
    Given a base commit
    And a later commit with the trailer "Co-Authored-By: Claude <noreply@anthropic.com>" that adds the run record "runs/run-1.jsonl"
    When the developer runs "osf check RUNS" against the base commit
    Then the command exits with code 0
    And the output contains "RUNS ok"

  @id=SCN-REPO-042 @status=implemented
  Scenario: RUNS asks no run record of commits without an agent trailer
    Given a base commit
    And a later commit without a "Co-Authored-By:" trailer that changes no file in "runs/"
    When the developer runs "osf check RUNS" against the base commit
    Then the command exits with code 0

  @id=SCN-REPO-043 @status=implemented @replaces=SCN-REPO-001
  Scenario: A module created from the template passes the fast checks of osf
    Given a repository with the module template and an accepted ADR for the module "demo"
    And the developer ran "osf new-module demo"
    When the developer runs "osf check"
    Then the command exits with code 0
    And the output contains "ARCH ok"
