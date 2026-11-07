@module=scorekit @owner=maintainers
Feature: Report scores
  "scorekit report" sums up score files per scorer: pass rate, cost, the pass rate per day and each scored run.

  @id=SCN-SCORE-023 @status=implemented @realizes=SCN-FACTORY-SCORE-003
  Scenario: The report shows each scorer's pass rate, cost and scored runs
    Given "scores.jsonl" with 4 scores of "redundant-tests", 3 with the value 1 and 1 with the value 0, each with the judge cost 0.01
    When the user runs "scorekit report scores.jsonl"
    Then the command exits with code 0
    And "report.json" shows "redundant-tests" with 4 runs scored, 3 passes, 1 fail, the pass rate 0.75 and the cost 0.04
    And "report.json" lists each run of "redundant-tests" with its result, reason, time and cost

  @id=SCN-SCORE-024 @status=implemented @realizes=SCN-FACTORY-SCORE-003
  Scenario: The report shows the pass rate per day
    Given "scores.jsonl" with 2 scores of "redundant-tests" on 2026-01-01, one of them passed, and 2 passed scores on 2026-01-02
    When the user runs "scorekit report scores.jsonl"
    Then "report.json" shows for "redundant-tests" the pass rate 0.5 on "2026-01-01" and 1 on "2026-01-02"

  @id=SCN-SCORE-025 @status=implemented @realizes=SCN-FACTORY-SCORE-004
  Scenario: The report is written as Markdown
    Given "scores.jsonl" with 4 scores of "redundant-tests", 3 with the value 1 and 1 with the value 0, each with the judge cost 0.01
    When the user runs "scorekit report scores.jsonl --markdown report.md"
    Then "report.md" has the row "| redundant-tests | 4 | 3 | 1 | 75.0% | 0.0400 |"

  @id=SCN-SCORE-060 @status=implemented
  Scenario: The Markdown report has a table of the scorers, then the days and the runs of each scorer
    Given "scores.jsonl" with 3 scores of "scope-creep" and "redundant-tests" not in time order, a label with the source "ANNOTATION" and a reason with "|" and a line break
    When the user runs "scorekit report scores.jsonl --markdown report.md"
    Then the command exits with code 0
    And the output has one line per scorer, sorted by name, with its runs, pass rate and cost
    And "report.md" has the table of the scorers, then for each scorer the table of its days and the table of its runs

  @id=SCN-SCORE-061 @status=implemented
  Scenario: A score file line that breaks the score contract is named with its file and line
    Given "scores.jsonl" whose second line is a JSON object with only the name "redundant-tests"
    When the user runs "scorekit report scores.jsonl"
    Then the command exits with code 2
    And the error output starts with "scorekit: scores.jsonl:2: not a score: "
