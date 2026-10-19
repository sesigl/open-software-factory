@module=testkit @owner=maintainers
Feature: Coverage of the running module
  Every Node process of the module under test records which of the module's code it ran, in
  reports/coverage/ of the workspace. The REACH check reads it.

  @id=SCN-TK-026 @status=implemented
  Scenario: The testkit records which functions of the module its system tests ran
    Given a module in a workspace whose CLI declares the functions "used" and "unused" and calls "used"
    And its system test runs the CLI
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And a file in "$INPUT/reports/coverage/" shows that "bin/demo.js" ran "used" and not "unused"
