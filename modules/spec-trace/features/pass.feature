@module=spec-trace @owner=maintainers
Feature: PASS
  The test of every implemented scenario ran and passed, read from JUnit XML reports.

  @id=SCN-TRACE-025 @status=implemented
  Scenario: PASS rejects a skipped test
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a JUnit report in which the test of "SCN-SHOP-001" was skipped
    When the developer runs "spec-trace check --only PASS"
    Then the command exits with code 1
    And the output contains "PASS features/checkout.feature:4 SCN-SHOP-001 was skipped"

  @id=SCN-TRACE-026 @status=implemented
  Scenario: PASS rejects a failed test
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a JUnit report in which the test of "SCN-SHOP-001" failed
    When the developer runs "spec-trace check --only PASS"
    Then the command exits with code 1
    And the output contains "PASS features/checkout.feature:4 SCN-SHOP-001 failed"

  @id=SCN-TRACE-027 @status=implemented
  Scenario: PASS rejects an implemented scenario whose test did not run
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a JUnit report without a test of "SCN-SHOP-001"
    When the developer runs "spec-trace check --only PASS"
    Then the command exits with code 1
    And the output contains "PASS features/checkout.feature:4 SCN-SHOP-001 did not run in this run"

  @id=SCN-TRACE-028 @status=implemented
  Scenario: PASS asks for a test run when there is no JUnit report
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    When the developer runs "spec-trace check --only PASS"
    Then the command exits with code 1
    And the output contains "PASS features/checkout.feature:4 no JUnit results in reports/junit: run the tests first"

  @id=SCN-TRACE-029 @status=implemented
  Scenario: PASS reads the scenario ID from the name of a test case
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a JUnit report with the passed test case "SCN-SHOP-001 a guest pays" without a scenario property
    When the developer runs "spec-trace check --only PASS"
    Then the command exits with code 0
    And the output contains "PASS ok"

  @id=SCN-TRACE-030 @status=implemented
  Scenario: PASS rejects an outline when one of its examples failed
    Given a repository with the implemented scenario outline "SCN-SHOP-001" with two examples and its test
    And a JUnit report with a passed and a failed test case for "SCN-SHOP-001"
    When the developer runs "spec-trace check --only PASS"
    Then the command exits with code 1
    And the output contains "PASS features/checkout.feature:4 SCN-SHOP-001 failed"

  @id=SCN-TRACE-031 @status=implemented
  Scenario: PASS reads the JUnit reports from the configured folder
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a JUnit report in "build/test-results" in which the test of "SCN-SHOP-001" passed
    And a spec-trace.json with the JUnit folder "build/test-results"
    When the developer runs "spec-trace check --only PASS"
    Then the command exits with code 0
    And the output contains "PASS ok"
