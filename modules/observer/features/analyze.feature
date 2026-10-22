@module=observer @owner=maintainers
Feature: Group failed scores into problems
  "observer analyze" reads the scores that scorekit writes and records one problem per scorer that failed often
  enough, with its count, its reasons and links to the failed runs.

  @id=SCN-OBS-004 @status=planned @realizes=SCN-FACTORY-IMPROVE-001
  Scenario: Analyze groups 30 failed scores of one scorer into one problem
    Given "scores.jsonl" with 30 failed and 10 passed scores of the scorer "research-skill-used"
    When the user runs "observer analyze scores.jsonl"
    Then the command exits with code 0
    And "$OUTPUT/problems.json" has one problem "research-skill-used" with 30 failures in 40 scored runs
    And the output says "research-skill-used: failed 30 of 40 runs (75.0%)"

  @id=SCN-OBS-005 @status=planned @realizes=SCN-FACTORY-IMPROVE-001
  Scenario: A failed run of a problem links to its transcript and its pull request
    Given "scores.jsonl" with failed scores of the scorer "research-skill-used" for the runs "run-1", "run-2" and "run-3"
    And a run record in "runs/" for the run "run-1" with the transcript "https://langfuse.example/trace/1" and the pull request "https://github.com/acme/web/pull/7"
    When the user runs "observer analyze --runs runs scores.jsonl"
    Then the problem "research-skill-used" lists the run "run-1" with the links "https://langfuse.example/trace/1" and "https://github.com/acme/web/pull/7"
    And it lists the runs "run-2" and "run-3" without links

  @id=SCN-OBS-006 @status=planned
  Scenario: A problem lists its reasons by frequency
    Given "scores.jsonl" with 2 failed scores of "research-skill-used" with the reason "No skill call." and 3 with the reason "Investigated inline."
    When the user runs "observer analyze scores.jsonl"
    Then the problem "research-skill-used" has the reasons "Investigated inline." 3 times and "No skill call." 2 times, in this order

  @id=SCN-OBS-007 @status=planned
  Scenario: A scorer with fewer than 3 failures is no problem
    Given "scores.jsonl" with 2 failed scores of "scope-creep" and 3 failed scores of "research-skill-used"
    When the user runs "observer analyze scores.jsonl"
    Then "$OUTPUT/problems.json" has only the problem "research-skill-used"

  @id=SCN-OBS-008 @status=planned
  Scenario: The option "--min-failures" sets how many failures make a problem
    Given "scores.jsonl" with 2 failed scores of "scope-creep" and 3 failed scores of "research-skill-used"
    When the user runs "observer analyze --min-failures 2 scores.jsonl"
    Then "$OUTPUT/problems.json" has the problems "research-skill-used" and "scope-creep", in this order

  @id=SCN-OBS-009 @status=planned
  Scenario: A run that a scorer scored twice counts once, with its latest score
    Given "scores.jsonl" where the run "run-1" failed "research-skill-used" at "2026-01-01T00:00:00Z" and passed it at "2026-01-02T00:00:00Z"
    And the runs "run-2", "run-3" and "run-4" failed "research-skill-used"
    When the user runs "observer analyze scores.jsonl"
    Then "$OUTPUT/problems.json" has one problem "research-skill-used" with 3 failures in 4 scored runs

  @id=SCN-OBS-010 @status=planned
  Scenario: Scores without many failures give no problem
    Given "scores.jsonl" with 1 failed and 5 passed scores of the scorer "research-skill-used"
    When the user runs "observer analyze scores.jsonl"
    Then the command exits with code 0
    And "$OUTPUT/problems.json" has no problem
    And the output says "no problems: no scorer failed 3 runs or more"

  @id=SCN-OBS-011 @status=planned
  Scenario: A line that is no score exits 2 and names the line
    Given "scores.jsonl" whose second line has no "traceId"
    When the user runs "observer analyze scores.jsonl"
    Then the command exits with code 2
    And the error output contains "scores.jsonl:2: not a score"

  @id=SCN-OBS-012 @status=planned
  Scenario: The option "--markdown" writes the problems as a table
    Given "scores.jsonl" with 30 failed and 10 passed scores of the scorer "research-skill-used"
    When the user runs "observer analyze --markdown problems.md scores.jsonl"
    Then "problems.md" has the row "| research-skill-used | 30 | 40 | 75.0% | Investigated inline. |"
