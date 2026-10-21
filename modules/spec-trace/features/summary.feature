@module=spec-trace @owner=maintainers
Feature: Markdown summary
  spec-trace report --summary <file> adds a Markdown summary of the report to the end of the file, for example the
  job summary of a workflow run.

  @id=SCN-TRACE-056 @status=planned
  Scenario: The summary shows the totals and the findings
    Given a repository with the implemented scenario "SCN-SHOP-001" and no test
    When the developer runs "spec-trace report --summary summary.md"
    Then the command exits with code 0
    And the file "summary.md" in the working folder contains "1 scenarios: 1 implemented, 0 planned, 0 deprecated; 0 with a test, 0 passed"
    And the file "summary.md" in the working folder contains "| TRACE | features/checkout.feature:4 | SCN-SHOP-001 is implemented but has no system test |"

  @id=SCN-TRACE-057 @status=planned
  Scenario: The summary lists the changes since the base commit
    Given a base commit with the planned scenario "SCN-SHOP-001" and its test
    And the scenario "SCN-SHOP-001" marked implemented since the base commit
    When the developer runs "spec-trace report --summary summary.md --base" with the base commit
    Then the command exits with code 0
    And the file "summary.md" in the working folder contains "| SCN-SHOP-001 | status planned → implemented |"

  @id=SCN-TRACE-058 @status=planned
  Scenario: The summary keeps what the file held before
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a file "summary.md" with the line "## Tests"
    When the developer runs "spec-trace report --summary summary.md"
    Then the command exits with code 0
    And the file "summary.md" in the working folder starts with "## Tests" and then contains "## spec-trace"
