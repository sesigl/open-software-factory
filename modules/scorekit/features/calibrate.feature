@module=scorekit @owner=maintainers
Feature: Calibrate a scorer
  "scorekit calibrate" judges every labeled run and compares the judge with the labels a person wrote. Labels are
  score records with the source "ANNOTATION".

  @id=SCN-SCORE-019 @status=implemented
  Scenario: Calibration reports the agreement with 20 labeled runs
    Given the runs file "runs.jsonl" with the 20 runs "run-01" to "run-20"
    And the labels file "labels.jsonl" that labels "run-01" to "run-10" "pass" and "run-11" to "run-20" "fail"
    And a model gateway whose judge agrees with the labels except for "run-10" and "run-11"
    When the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl runs.jsonl"
    Then the command exits with code 0
    And the model gateway received 20 judge calls
    And the output contains "agreement 18 of 20 (90.0%)"
    And "calibration.json" has the agreement 0.9, the kappa 0.8 and the counts 9 true pass, 1 false pass, 9 true fail and 1 false fail

  @id=SCN-SCORE-020 @status=implemented
  Scenario: Calibration lists each disagreement with the label, the result and the reason
    Given the runs file "runs.jsonl" with the runs "run-01" and "run-02"
    And the labels file "labels.jsonl" that labels "run-01" "pass" and "run-02" "pass"
    And a model gateway that fails "run-02" with the reason "The tests repeat each other."
    When the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl runs.jsonl"
    Then "calibration.json" lists the disagreement "run-02" with the label "pass", the result "fail" and the reason "The tests repeat each other."

  @id=SCN-SCORE-021 @status=implemented
  Scenario: Calibration below the minimum agreement fails the command
    Given the runs file "runs.jsonl" with the runs "run-01" and "run-02"
    And the labels file "labels.jsonl" that labels "run-01" "pass" and "run-02" "pass"
    And a model gateway that fails "run-02" with the reason "The tests repeat each other."
    When the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl --min-agreement 0.8 runs.jsonl"
    Then the command exits with code 1
    And the output contains "agreement 1 of 2 (50.0%) is below 80.0%"

  @id=SCN-SCORE-022 @status=implemented
  Scenario: A label without a run is named and not counted
    Given the runs file "runs.jsonl" with the run "run-01"
    And the labels file "labels.jsonl" that labels "run-01" "pass" and "run-02" "pass"
    And a model gateway that answers every judge call with the result "pass" and the reason "Fine."
    When the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl runs.jsonl"
    Then the command exits with code 0
    And the error output contains "no run for the label of run-02"
    And the output contains "agreement 1 of 1 (100.0%)"

  @id=SCN-SCORE-062 @status=implemented
  Scenario: Calibration uses only the labels of the scorer with the source ANNOTATION
    Given the runs file "runs.jsonl" with the runs "run-01" to "run-03"
    And the labels file "labels.jsonl" with an ANNOTATION label of "redundant-tests" for "run-01" and "run-04", a score of "redundant-tests" with the source "API" for "run-02" and an ANNOTATION label of "scope-creep" for "run-03"
    And a model gateway that answers every judge call with the result "pass" and the reason "Fine."
    When the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl runs.jsonl"
    Then the command exits with code 0
    And the model gateway received 1 judge call
    And the output is "agreement 1 of 1 (100.0%)"
    And the error output is "scorekit: no run for the label of run-04"

  @id=SCN-SCORE-063 @status=implemented
  Scenario: The minimum agreement takes the bounds 0 and 1, and an agreement equal to the minimum passes
    Given the runs file "runs.jsonl" with the runs "run-01" to "run-03"
    And the labels file "labels.jsonl" that labels "run-01" "pass", "run-02" "fail" and "run-03" "pass"
    And a model gateway that passes "run-01" and "run-02" and fails "run-03"
    When the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl runs.jsonl" with "--min-agreement" 0, 0.333333 and 1
    Then the commands exit with the codes 0, 0 and 1
    And the outputs are "agreement 1 of 3 (33.3%), kappa -0.50" twice and then "agreement 1 of 3 (33.3%) is below 100.0%"

  @id=SCN-SCORE-064 @status=implemented
  Scenario: Wrong options of "scorekit calibrate" are refused with the reason
    Given the runs file "runs.jsonl" with the run "run-01"
    And the labels file "labels.jsonl" that labels "run-01" "pass"
    When the user runs "scorekit calibrate --scorer redundant-tests" with each of these arguments
      | arguments                                          | error                                                                    |
      | runs.jsonl                                         | --labels is required: a file of score records with the source ANNOTATION |
      | --labels labels.jsonl --min-agreement 1.5 runs.jsonl  | --min-agreement must be a number from 0 to 1                          |
      | --labels labels.jsonl --min-agreement=-0.5 runs.jsonl | --min-agreement must be a number from 0 to 1                          |
      | --labels labels.jsonl --min-agreement most runs.jsonl | --min-agreement must be a number from 0 to 1                          |
    Then each command exits with code 2
    And the error output of each command is "scorekit: " and the error of its row

  @id=SCN-SCORE-065 @status=implemented
  Scenario: A judge answer without a verdict fails the calibration and shows the first 200 characters of the answer
    Given the runs file "runs.jsonl" with the run "run-01"
    And the labels file "labels.jsonl" that labels "run-01" "pass"
    And a model gateway that answers the judge call for "run-01" with 300 characters that are not a verdict
    When the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl runs.jsonl"
    Then the command exits with code 1
    And the error output is "scorekit: run-01: the judge's answer is not a verdict: " and the first 200 characters of the answer
