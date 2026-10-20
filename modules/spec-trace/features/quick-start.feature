@module=spec-trace @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-TRACE-001 @status=implemented
  Scenario: A new user reports the scenario coverage of the sample repository from the README
    Given the feature file and the test from the README
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
    And the report lists "SCN-SHOP-001" as "implemented" with the test "tests/SCN-SHOP-001.test.ts:3"

  @id=SCN-TRACE-002 @status=implemented
  Scenario: The help lists every command
    When the user runs "spec-trace --help"
    Then the command exits with code 0
    And the output lists the commands "check", "report" and "next-id"
