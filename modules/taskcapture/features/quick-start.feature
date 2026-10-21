@module=taskcapture @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-TASK-001 @status=planned @realizes=SCN-FACTORY-BENCH-004
  Scenario: A new user compares two models on the sample trial results from the README
    Given the sample trial results from the README
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
    And the output says "most efficient: v1 · openrouter/z-ai/glm-5.3-flash"

  @id=SCN-TASK-002 @status=planned
  Scenario: The help lists every command
    When the user runs "taskcapture --help"
    Then the command exits with code 0
    And the output lists the commands "capture", "report" and "route"

  @id=SCN-TASK-003 @status=planned
  Scenario: An unknown command shows the usage
    When the user runs "taskcapture bench"
    Then the command exits with code 2
    And the error output starts with "Usage: taskcapture <command>"
