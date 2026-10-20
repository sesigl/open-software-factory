@module=spec-trace @owner=maintainers
Feature: report
  spec-trace report writes one JSON report of every scenario, its tests, its result and its evidence.

  @id=SCN-TRACE-039 @status=planned
  Scenario: report lists each scenario with its status, its test and its result
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test and the planned scenario "SCN-SHOP-002" without one
    And a JUnit report in which the test of "SCN-SHOP-001" passed
    When the developer runs "spec-trace report"
    Then the command exits with code 0
    And the output ends with "2 scenarios: 1 implemented, 1 planned, 0 deprecated; 1 with a test, 1 passed"
    And the report lists "SCN-SHOP-001" as "implemented" with the result "passed" and "SCN-SHOP-002" as "planned" with the result "not run"

  @id=SCN-TRACE-040 @status=planned
  Scenario: report counts a scenario outline once
    Given a repository with the implemented scenario outline "SCN-SHOP-001" with three examples and its test
    When the developer runs "spec-trace report"
    Then the command exits with code 0
    And the report counts 1 scenario and lists "SCN-SHOP-001" with 3 examples

  @id=SCN-TRACE-041 @status=planned
  Scenario: report has no result and no PASS finding without a JUnit report
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    When the developer runs "spec-trace report"
    Then the command exits with code 0
    And the report lists "SCN-SHOP-001" with the result null and has no finding

  @id=SCN-TRACE-042 @status=planned
  Scenario: report lists the findings of the rules
    Given a repository with the implemented scenario "SCN-SHOP-001" and no test
    When the developer runs "spec-trace report"
    Then the command exits with code 0
    And the report has the TRACE finding "SCN-SHOP-001 is implemented but has no system test" at "features/checkout.feature:4"

  @id=SCN-TRACE-043 @status=planned
  Scenario: report counts the artifacts of a proof bundle per scenario
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test and the planned scenario "SCN-SHOP-002" without one
    And a proof bundle in "evidence" with two artifacts for "SCN-SHOP-001"
    When the developer runs "spec-trace report --evidence evidence"
    Then the command exits with code 0
    And the report lists "SCN-SHOP-001" with the evidence 2 and "SCN-SHOP-002" with the evidence 0

  @id=SCN-TRACE-044 @status=planned
  Scenario: report rejects a bundle that does not match the evidence-bundle contract
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a bundle in "evidence" whose evidence.json has no scenarios
    When the developer runs "spec-trace report --evidence evidence"
    Then the command exits with code 2
    And the error output contains "spec-trace: evidence/evidence.json does not match the evidence-bundle contract"

  @id=SCN-TRACE-045 @status=planned
  Scenario: report writes the file named by --out
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    When the developer runs "spec-trace report --out build/trace.json"
    Then the command exits with code 0
    And the file "build/trace.json" in the working folder lists "SCN-SHOP-001"
