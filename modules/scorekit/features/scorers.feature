@module=scorekit @owner=maintainers
Feature: Scorer pack
  scorekit ships scorers for common failure modes of coding agents. "--scorer" takes a pack name or a file.

  @id=SCN-SCORE-028 @status=planned @realizes=SCN-FACTORY-SCORE-004
  Scenario: The pack lists five scorers with their sampling rate and description
    When the user runs "scorekit scorers"
    Then the command exits with code 0
    And the output lists the scorers "redundant-tests", "change-requested", "scope-creep", "skipped-checks" and "needless-human-question"
    And each line shows the scorer's sampling rate and description
