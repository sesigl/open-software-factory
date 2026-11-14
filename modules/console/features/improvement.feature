@module=console @owner=maintainers
Feature: Cost and scores of the factory's runs
  The page "/improvement" shows what the scheduled jobs of the improvement path wrote to the folder
  "CONSOLE_IMPROVE_DIR": run records as runlog writes them and score records as scorekit writes them, both in the
  formats of the contracts. The console reads every ".json" and ".jsonl" file below the folder when the page is opened
  (ADR 0123).

  @id=SCN-CONSOLE-090 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: The improvement page shows each scorer's pass rate and each run's cost
    Given "CONSOLE_IMPROVE_DIR" names a folder with the stage "implement" of "run_a" at 0.25 USD, the stage "review" of "run_b" at 0.5 USD and its stage "triage" without a cost, the scorer "redundant-tests" that passed "run_a" and failed "run_b" at 0.01 USD each, and the scorer "slow-tests" that failed "run_a" without a cost
    When a person opens "/improvement"
    Then the table "Scores" shows "redundant-tests" with 2 scored, 1 passed, "50%" and "0.02 USD", and "slow-tests" with 1 scored, 0 passed, "0%" and "0.00 USD"
    And the table "Runs" shows "run_a" with "implement", "succeeded" and "0.25 USD", "run_b" with "review", "failed" and "0.50 USD", and "run_b" with "triage", "succeeded" and "0.00 USD"
    And the page says "0.75 USD over 2 runs" and its navigation links "/improvement"

  @id=SCN-CONSOLE-092 @status=implemented
  Scenario: The improvement page reads only the records of ".json" and ".jsonl" files and skips other lines
    Given "CONSOLE_IMPROVE_DIR" names a folder with a score of "redundant-tests" in "scores.jsonl", a line that is no JSON and a CloudEvent in it, a run record of "run_a" in "run_a.json", and a score of "slow-tests" in "scores.jsonl.bak"
    When a person opens "/improvement"
    Then the table "Scores" shows only "redundant-tests"
    And the table "Runs" shows "run_a"

  @id=SCN-CONSOLE-091 @status=implemented
  Scenario: Without a folder the improvement page answers 404
    Given "console serve" runs without "CONSOLE_IMPROVE_DIR"
    When a person opens "/improvement"
    Then the page answers 404 and says "no cost and scores: set CONSOLE_IMPROVE_DIR to the folder of the improvement jobs"
    And the navigation does not link "/improvement"
