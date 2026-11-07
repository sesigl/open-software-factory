@module=spec-trace @owner=maintainers
Feature: Markdown summary
  spec-trace report --summary <file> adds a Markdown summary of the report to the end of the file, for example the
  job summary of a workflow run.

  @id=SCN-TRACE-056 @status=implemented
  Scenario: The summary shows the totals and the findings
    Given a repository with the implemented scenario "SCN-SHOP-001" and no test
    When the developer runs "spec-trace report --summary summary.md"
    Then the command exits with code 0
    And the file "summary.md" in the working folder contains "1 scenarios: 1 implemented, 0 planned, 0 deprecated; 0 with a test, 0 passed"
    And the file "summary.md" in the working folder contains "| TRACE | features/checkout.feature:4 | SCN-SHOP-001 is implemented but has no system test |"

  @id=SCN-TRACE-057 @status=implemented
  Scenario: The summary lists the changes since the base commit
    Given a base commit with the planned scenario "SCN-SHOP-001" and its test
    And the scenario "SCN-SHOP-001" marked implemented since the base commit
    When the developer runs "spec-trace report --summary summary.md --base" with the base commit
    Then the command exits with code 0
    And the file "summary.md" in the working folder contains "| SCN-SHOP-001 | status planned → implemented |"

  @id=SCN-TRACE-058 @status=implemented
  Scenario: The summary keeps what the file held before
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a file "summary.md" with the line "## Tests"
    When the developer runs "spec-trace report --summary summary.md"
    Then the command exits with code 0
    And the file "summary.md" in the working folder starts with "## Tests" and then contains "## spec-trace"

  @id=SCN-TRACE-065 @status=implemented
  Scenario: The summary without changes and findings has the totals, the change line and no table
    Given a base commit with the implemented scenario "SCN-SHOP-001" and its test
    When the developer runs "spec-trace report --summary summary.md --base" with the base commit
    Then the command exits with code 0
    And the file "summary.md" in the working folder has the lines "## spec-trace", "", "1 scenarios: 1 implemented, 0 planned, 0 deprecated; 1 with a test, 0 passed", "", "### Changes since `<base>`", "", "since the base: 0 added, 0 removed, 0 with a new status, 0 with new steps.", "", "### Findings", "", "No findings.", ""

  @id=SCN-TRACE-066 @status=implemented
  Scenario: The summary has one table row for each change and for each finding
    Given a base commit with the planned scenarios "SCN-SHOP-001" and "SCN-SHOP-002"
    And since the base commit "SCN-SHOP-001" is implemented with a new step and no test, "SCN-SHOP-002" is deleted and the planned "SCN-SHOP-003" is added
    When the developer runs "spec-trace report --summary summary.md --base" with the base commit
    Then the command exits with code 0
    And the file "summary.md" in the working folder has the lines "## spec-trace", "", "2 scenarios: 1 implemented, 1 planned, 0 deprecated; 0 with a test, 0 passed", "", "### Changes since `<base>`", "", "since the base: 1 added, 1 removed, 1 with a new status, 1 with new steps.", "", "| Scenario | Change |", "| --- | --- |", "| SCN-SHOP-003 | added |", "| SCN-SHOP-002 | removed |", "| SCN-SHOP-001 | status planned → implemented |", "| SCN-SHOP-001 | steps changed |", "", "### Findings", "", "| Rule | Where | Finding |", "| --- | --- | --- |", "| TRACE | features/checkout.feature:4 | SCN-SHOP-001 is implemented but has no system test |", ""
