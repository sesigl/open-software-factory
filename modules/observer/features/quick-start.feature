@module=observer @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-OBS-001 @status=implemented @realizes=SCN-FACTORY-IMPROVE-001
  Scenario: A new user finds the problem in the sample scores from the README
    Given the sample scores from the README
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
    And the output says "research-skill-used: failed 3 of 4 runs (75.0%)"

  @id=SCN-OBS-002 @status=implemented
  Scenario: The help lists every command
    When the user runs "observer --help"
    Then the command exits with code 0
    And the output lists the commands "analyze", "propose" and "check"

  @id=SCN-OBS-003 @status=implemented
  Scenario: An unknown command shows the usage
    When the user runs "observer improve"
    Then the command exits with code 2
    And the error output starts with "Usage: observer <command>"
