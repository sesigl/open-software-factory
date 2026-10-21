@module=scorekit @owner=maintainers
Feature: Scorer pack
  scorekit ships scorers for common failure modes of coding agents. "--scorer" takes a pack name or a file.

  @id=SCN-SCORE-028 @status=implemented @realizes=SCN-FACTORY-SCORE-004
  Scenario: The pack lists five scorers with their sampling rate and description
    When the user runs "scorekit scorers"
    Then the command exits with code 0
    And the output lists the scorers "redundant-tests", "change-requested", "scope-creep", "skipped-checks" and "needless-human-question"
    And each line shows the scorer's sampling rate and description

  @id=SCN-SCORE-030 @status=implemented
  Scenario: A scorer file without a pass criterion is refused
    Given the scorer file "scorers/vague.md" without the key "pass"
    And the runs file "runs.jsonl" with the run "run-01"
    When the user runs "scorekit score --scorer scorers/vague.md runs.jsonl"
    Then the command exits with code 2
    And the error output names the file "scorers/vague.md" and the missing key "pass"

  @id=SCN-SCORE-031 @status=implemented
  Scenario: A scorer file whose front matter is not YAML is refused
    Given the scorer file "scorers/broken.md" whose front matter is "pass: [The run is fine."
    And the runs file "runs.jsonl" with the run "run-01"
    When the user runs "scorekit score --scorer scorers/broken.md runs.jsonl"
    Then the command exits with code 2
    And the error output names the file "scorers/broken.md" and says the front matter is not YAML
