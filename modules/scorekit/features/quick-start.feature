@module=scorekit @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-SCORE-001 @status=planned @realizes=SCN-FACTORY-SCORE-001
  Scenario: A new user scores the sample runs from the README
    Given the runs file from the README
    And a model gateway that answers every judge call with the result "pass" and the reason "No test repeats another."
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
    And "scores.jsonl" holds 2 scores of the scorer "redundant-tests" with the value 1 and the comment "No test repeats another."

  @id=SCN-SCORE-002 @status=planned
  Scenario: The help lists every command
    When the user runs "scorekit --help"
    Then the command exits with code 0
    And the output lists the commands "score", "calibrate", "report", "push" and "scorers"
