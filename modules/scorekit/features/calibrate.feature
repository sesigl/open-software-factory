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
