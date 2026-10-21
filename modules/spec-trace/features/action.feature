@module=spec-trace @owner=maintainers
Feature: GitHub Action
  "uses: sesigl/open-software-factory/modules/spec-trace@spec-trace-v<version>" writes the report of the workflow
  run with a job summary, then checks the rules. It fails when a rule has a finding.

  @id=SCN-TRACE-059 @status=implemented
  Scenario: The action passes and names the report when every rule passes
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a JUnit report in which the test of "SCN-SHOP-001" passed
    When a push workflow runs the action with "out: build/trace.json"
    Then the action succeeds
    And the output contains "PASS ok"
    And the report named in the action output "report" lists "SCN-SHOP-001" with the result "passed"

  @id=SCN-TRACE-060 @status=implemented
  Scenario: A finding fails the action
    Given a repository with the implemented scenario "SCN-SHOP-001" and no test
    When a push workflow runs the action with "rules: SPEC,TRACE,STEPS"
    Then the action fails with code 1
    And the output contains "TRACE features/checkout.feature:4 SCN-SHOP-001 is implemented but has no system test"

  @id=SCN-TRACE-061 @status=implemented
  Scenario: The action checks only the rules of the input "rules"
    Given a repository with the implemented scenario "SCN-SHOP-001" and no test
    When a push workflow runs the action with "rules: SPEC"
    Then the action succeeds
    And the output contains "SPEC ok" and not "TRACE"

  @id=SCN-TRACE-062 @status=implemented
  Scenario: On a pull request the action compares with the base commit of the pull request
    Given a base commit with the planned scenario "SCN-SHOP-001" and its test
    And the planned scenario "SCN-SHOP-002" added since the base commit
    When a pull request workflow whose base is the base commit runs the action with "rules: SPEC" and "out: build/trace.json"
    Then the action succeeds
    And the report named in the action output "report" lists "SCN-SHOP-002" as added since the base commit

  @id=SCN-TRACE-063 @status=implemented
  Scenario: The action writes the summary to the job summary
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    When a push workflow runs the action with "rules: SPEC"
    Then the action succeeds
    And the job summary contains "## spec-trace"

  @id=SCN-TRACE-064 @status=implemented
  Scenario: The action passes the proof bundles of the input "evidence" to the report
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a proof bundle in "evidence" with two artifacts for "SCN-SHOP-001"
    When a push workflow runs the action with "rules: SPEC", "evidence: evidence" and "out: build/trace.json"
    Then the action succeeds
    And the report named in the action output "report" lists "SCN-SHOP-001" with the evidence 2
