@module=testkit @owner=maintainers
Feature: Quick start
  A developer writes the system test of a scenario with the testkit and runs it with "testkit run".

  @id=SCN-TK-001 @status=implemented
  Scenario: The JUnit result of a scenario's system test carries the scenario ID
    Given a module with the implemented scenario "SCN-DEMO-001" and its passing system test
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has a test case named "SCN-DEMO-001" with the property "scenario" set to "SCN-DEMO-001"

  @id=SCN-TK-002 @status=implemented
  Scenario: sut.files refuses a path outside $INPUT and $OUTPUT
    Given a module whose system test puts the file "$INPUT/../secret.txt"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "sut.files refuses a path outside $INPUT and $OUTPUT: $INPUT/../secret.txt"

  @id=SCN-TK-139 @status=implemented
  Scenario: testkit timed runs the command, and with CI set it writes the runner's slowdown
    Given the environment variable "CI" is set to "true"
    When the developer runs "testkit timed node -e process.exit(3)"
    Then the command exits with code 3
    And "reports/runner-speed.json" has two benchmark times in milliseconds, the reference time and the slowdown

  @id=SCN-TK-140 @status=implemented
  Scenario: testkit timed without CI only runs the command
    When the developer runs "testkit timed node -e process.exit(0)" without the environment variable "CI"
    Then the command exits with code 0
    And there is no file "reports/runner-speed.json"
