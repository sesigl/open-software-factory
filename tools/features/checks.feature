@module=tools @owner=maintainers
Feature: Repository checks
  The checks of docs/quality/checks.md run as "osf check" in a repository. Each failure prints its check ID and
  the file and line to fix. Checks that compare against a base read the Git ref from OSF_BASE.

  @id=SCN-REPO-001 @status=implemented
  Scenario: A module created from the template passes the fast checks
    Given a repository with the module template and an accepted ADR for the module "demo"
    And the developer ran "osf new-module demo"
    When the developer runs "osf check"
    Then the command exits with code 0
    And the output contains "SPEC ok"

  @id=SCN-REPO-002 @status=implemented
  Scenario: SPEC rejects a duplicate scenario ID
    Given a repository with two scenarios with the ID "SCN-DEMO-001"
    When the developer runs "osf check SPEC"
    Then the command exits with code 1
    And the output contains "SPEC modules/demo/features/b.feature:5 duplicate ID SCN-DEMO-001"

  @id=SCN-REPO-003 @status=implemented
  Scenario: TRACE rejects an implemented scenario without a system test
    Given a repository with the implemented scenario "SCN-DEMO-001" and no system test
    When the developer runs "osf check TRACE"
    Then the command exits with code 1
    And the output contains "TRACE modules/demo/features/a.feature:5 SCN-DEMO-001 is implemented but has no system test"

  @id=SCN-REPO-004 @status=implemented
  Scenario: STEPS rejects a label that differs from the step
    Given a repository with the implemented scenario "SCN-DEMO-001" and its system test
    And the test labels the step 'When the user runs "demo run"' as "the user runs demo"
    When the developer runs "osf check STEPS"
    Then the command exits with code 1
    And the output contains "STEPS modules/demo/system-tests/SCN-DEMO-001.test.ts:7"
    And the output contains "differs from the step"

  @id=SCN-REPO-005 @status=implemented
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

  @id=SCN-REPO-007 @status=implemented
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
