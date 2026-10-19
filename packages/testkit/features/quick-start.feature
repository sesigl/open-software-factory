@module=testkit @owner=maintainers
Feature: Quick start
  A developer writes the system test of a scenario with the testkit and runs it with "testkit run".

  @id=SCN-TK-001 @status=implemented
  Scenario: The JUnit result of a scenario's system test carries the scenario ID
    Given a module with the implemented scenario "SCN-DEMO-001" and its passing system test
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has a test case named "SCN-DEMO-001" with the property "scenario" set to "SCN-DEMO-001"
