@module=scorekit @owner=maintainers
Feature: Report scores
  "scorekit report" sums up score files per scorer: pass rate, cost, the pass rate per day and each scored run.

  @id=SCN-SCORE-023 @status=planned @realizes=SCN-FACTORY-SCORE-003
  Scenario: The report shows each scorer's pass rate, cost and scored runs
    Given "scores.jsonl" with 4 scores of "redundant-tests", 3 with the value 1 and 1 with the value 0, each with the judge cost 0.01
    When the user runs "scorekit report scores.jsonl"
    Then the command exits with code 0
    And "report.json" shows "redundant-tests" with 4 runs scored, 3 passes, 1 fail, the pass rate 0.75 and the cost 0.04
    And "report.json" lists each run of "redundant-tests" with its result, reason, time and cost

  @id=SCN-SCORE-024 @status=planned @realizes=SCN-FACTORY-SCORE-003
  Scenario: The report shows the pass rate per day
    Given "scores.jsonl" with 2 scores of "redundant-tests" on 2026-01-01, one of them passed, and 2 passed scores on 2026-01-02
    When the user runs "scorekit report scores.jsonl"
    Then "report.json" shows for "redundant-tests" the pass rate 0.5 on "2026-01-01" and 1 on "2026-01-02"

  @id=SCN-SCORE-025 @status=planned @realizes=SCN-FACTORY-SCORE-004
  Scenario: The report is written as Markdown
    Given "scores.jsonl" with 4 scores of "redundant-tests", 3 with the value 1 and 1 with the value 0, each with the judge cost 0.01
    When the user runs "scorekit report scores.jsonl --markdown report.md"
    Then "report.md" has the row "| redundant-tests | 4 | 3 | 1 | 75.0% | 0.0400 |"
