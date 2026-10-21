@module=taskcapture @owner=maintainers
Feature: Report correctness against cost
  "taskcapture report" reads the trial results Harbor writes. A cell is one configuration, the name of a trial's
  job folder, and one model. Each cell gets its correctness and its average cost per trial; the report names the
  best, the lowest-cost and the most efficient cell and flags cells whose scoring is incomplete.

  @id=SCN-TASK-022 @status=implemented @realizes=SCN-FACTORY-BENCH-003 @realizes=SCN-FACTORY-CODE-004
  Scenario: A matrix of 2 configurations and 2 models gives 4 cells with correctness and cost
    Given the job folders "v1" and "v2", each with the trials of the models "model-a" and "model-b" on the tasks "web-1" and "web-2"
    When the user runs "taskcapture report v1 v2"
    Then the command exits with code 0
    And "report.json" has 4 cells, one for each configuration and model
    And "report.json" shows the cell "v2" and "model-b" with correctness 0.5 and 0.3 USD per trial over 2 trials

  @id=SCN-TASK-023 @status=implemented @realizes=SCN-FACTORY-BENCH-004
  Scenario: The report names the best, the lowest-cost and the most efficient cell
    Given the job folder "v1" where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD
    When the user runs "taskcapture report v1"
    Then "report.json" names "gpt-5.6-sol" the best, "llama-9-tiny" the lowest cost and "glm-5.3-flash" the most efficient
    And "report.json" has the Pareto front "llama-9-tiny", "glm-5.3-flash" and "gpt-5.6-sol"

  @id=SCN-TASK-024 @status=implemented @realizes=SCN-FACTORY-BENCH-005
  Scenario: A cell whose trial ended in an error is flagged as incomplete
    Given the job folder "v1" where "model-a" scored "web-1" and "web-2" and "model-b" scored "web-1" and ended "web-2" with the error "AgentTimeoutError"
    When the user runs "taskcapture report v1"
    Then "report.json" flags the cell "v1" and "model-b" as incomplete with 1 of 2 tasks scored and the missing task "web-2"
    And the output says "v1 · model-b: correctness uses 1 of 2 tasks; rerun with: harbor job resume --job-path v1 --filter-error-type AgentTimeoutError"

  @id=SCN-TASK-025 @status=implemented @realizes=SCN-FACTORY-BENCH-005
  Scenario: A task a cell never ran counts as missing
    Given the job folder "v1" where "model-a" ran "web-1" and "web-2" and "model-b" ran only "web-1"
    When the user runs "taskcapture report v1"
    Then "report.json" flags the cell "v1" and "model-b" as incomplete with 1 of 2 tasks scored and the missing task "web-2"

  @id=SCN-TASK-026 @status=implemented
  Scenario: A trial without a cost leaves the average to the trials with one
    Given the job folder "v1" where "model-a" ran "web-1" for 2.00 USD and "web-2" without a cost
    When the user runs "taskcapture report v1"
    Then "report.json" shows the cell "v1" and "model-a" with 2 USD per trial and 1 trial without a cost

  @id=SCN-TASK-027 @status=implemented
  Scenario: The option "--markdown" writes the cells as a Markdown table
    Given the job folder "v1" where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD
    When the user runs "taskcapture report --markdown report.md v1"
    Then "report.md" has the table row "| v1 | glm-5.3-flash | 90.0% | 1.99 | 1 of 1 |"
    And "report.md" says "Most efficient: v1 · glm-5.3-flash"

  @id=SCN-TASK-028 @status=implemented @realizes=SCN-FACTORY-BENCH-004
  Scenario: The option "--chart" writes a Vega-Lite chart of correctness against cost
    Given the job folder "v1" where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD
    When the user runs "taskcapture report --chart chart.json v1"
    Then "chart.json" is a Vega-Lite point chart with the average cost per trial on x and the correctness on y
    And "chart.json" holds 3 points, one per cell

  @id=SCN-TASK-029 @status=implemented
  Scenario: A folder without trial results exits 2
    Given an empty folder "jobs"
    When the user runs "taskcapture report jobs"
    Then the command exits with code 2
    And the error output says "taskcapture: no Harbor trial result (result.json with trial_name) in jobs"
