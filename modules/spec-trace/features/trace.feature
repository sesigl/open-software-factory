@module=spec-trace @owner=maintainers
Feature: TRACE
  Every implemented scenario has exactly one test, every test names a scenario, and deprecated scenarios have none.

  @id=SCN-TRACE-011 @status=planned
  Scenario: TRACE rejects an implemented scenario without a test
    Given a repository with the implemented scenario "SCN-SHOP-001" and no test
    When the developer runs "spec-trace check --only TRACE"
    Then the command exits with code 1
    And the output contains "TRACE features/checkout.feature:4 SCN-SHOP-001 is implemented but has no system test"

  @id=SCN-TRACE-012 @status=planned
  Scenario: TRACE rejects an implemented scenario with two tests
    Given a repository with the implemented scenario "SCN-SHOP-001" and the tests "tests/a.test.ts" and "tests/b.test.ts"
    When the developer runs "spec-trace check --only TRACE"
    Then the command exits with code 1
    And the output contains "TRACE features/checkout.feature:4 SCN-SHOP-001 has 2 system tests: tests/a.test.ts:3, tests/b.test.ts:3"

  @id=SCN-TRACE-013 @status=planned
  Scenario: TRACE rejects a test that names no scenario
    Given a repository with a test for "SCN-SHOP-002" and no scenario with that ID
    When the developer runs "spec-trace check --only TRACE"
    Then the command exits with code 1
    And the output contains "TRACE tests/SCN-SHOP-002.test.ts:3 SCN-SHOP-002 names no scenario"

  @id=SCN-TRACE-014 @status=planned
  Scenario: TRACE rejects a deprecated scenario that still has a test
    Given a repository with the deprecated scenario "SCN-SHOP-001" and its test
    When the developer runs "spec-trace check --only TRACE"
    Then the command exits with code 1
    And the output contains "TRACE features/checkout.feature:4 SCN-SHOP-001 is deprecated but still has a system test"

  @id=SCN-TRACE-015 @status=planned
  Scenario: TRACE rejects a scenario ID that is not a string literal
    Given a repository with a test that passes the scenario ID in a variable
    When the developer runs "spec-trace check --only TRACE"
    Then the command exits with code 1
    And the output contains "TRACE tests/SCN-SHOP-001.test.ts:4 the scenario ID must be a string literal"

  @id=SCN-TRACE-016 @status=planned
  Scenario: TRACE accepts planned scenarios with and without a test
    Given a repository with the planned scenario "SCN-SHOP-001" and its test and the planned scenario "SCN-SHOP-002" without one
    When the developer runs "spec-trace check --only TRACE"
    Then the command exits with code 0
    And the output contains "TRACE ok"

  @id=SCN-TRACE-017 @status=planned
  Scenario: TRACE rejects a test outside the configured test folder
    Given a repository with the implemented scenario "SCN-SHOP-001" in "shop/features/checkout.feature" and its test in "tests/"
    And a spec-trace.json with the test folder "system-tests"
    When the developer runs "spec-trace check --only TRACE"
    Then the command exits with code 1
    And the output contains "TRACE tests/SCN-SHOP-001.test.ts:3 the test of SCN-SHOP-001 must live in shop/system-tests/"

  @id=SCN-TRACE-018 @status=planned
  Scenario: TRACE rejects an adapter without a test for a conformance scenario of its port
    Given a port "forge" with the implemented @conformance scenario "SCN-FORGE-001" and the adapters "a" and "b"
    And only the adapter "a" has a test for "SCN-FORGE-001"
    And a spec-trace.json with the conformance tag "@conformance" for "ports/{port}/features/" and "adapters/{port}/{adapter}/"
    When the developer runs "spec-trace check --only TRACE"
    Then the command exits with code 1
    And the output contains "TRACE ports/forge/features/checkout.feature:4 SCN-FORGE-001 needs exactly one system test in adapters/forge/b/, has 0"

  @id=SCN-TRACE-019 @status=planned
  Scenario: TRACE reads the tests of a configured function name
    Given a repository with the implemented scenario "SCN-SHOP-001" and a test that calls "spec" instead of "scenario"
    And a spec-trace.json with the function "spec"
    When the developer runs "spec-trace check --only TRACE"
    Then the command exits with code 0
    And the output contains "TRACE ok"
