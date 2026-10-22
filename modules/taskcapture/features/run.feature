@module=taskcapture @owner=maintainers
Feature: Run the suite with Harbor
  "taskcapture run" starts the "harbor" CLI as a separate process, one Harbor job per configuration, with every
  model named. Then it reports correctness against cost over the jobs it ran. The agent of a captured task has no
  network during its run, except the hosts named with "--allow-host", so a replay reaches no real chat or forge.

  @id=SCN-TASK-042 @status=implemented @realizes=SCN-FACTORY-BENCH-003
  Scenario: A matrix of 2 configurations and 2 models runs one Harbor job per configuration
    Given a suite with the tasks "web-1" and "web-2" and a Harbor that scores every trial
    When the user runs "taskcapture run --suite suite --agent claude-code --model model-a --model model-b --configuration v1 --configuration v2"
    Then the command exits with code 0
    And Harbor ran 2 jobs, "v1" and "v2", each with the agent "claude-code" and the models "model-a" and "model-b"
    And "report.json" has 4 cells, one for each configuration and model

  @id=SCN-TASK-043 @status=implemented @realizes=SCN-FACTORY-BENCH-004
  Scenario: Run reports correctness against cost over the jobs it ran
    Given a suite with the tasks "web-1" and "web-2" and a Harbor where "model-a" solves both for 2.00 USD and "model-b" solves "web-1" for 0.50 USD
    When the user runs "taskcapture run --suite suite --agent claude-code --model model-a --model model-b --configuration v1"
    Then the output says "most efficient: v1 · model-b"
    And the output says "wrote $OUTPUT/report.json"

  @id=SCN-TASK-044 @status=implemented
  Scenario: A configuration with a Harbor config file passes the file to its job
    Given a suite with the tasks "web-1" and "web-2" and a Harbor that scores every trial
    When the user runs "taskcapture run --suite suite --agent claude-code --model model-a --configuration v1 --configuration v2=harbor-v2.yaml"
    Then Harbor ran the job "v2" with "--config harbor-v2.yaml"
    And Harbor ran the job "v1" without "--config"

  @id=SCN-TASK-045 @status=implemented @realizes=SCN-FACTORY-BENCH-002
  Scenario: The option "--allow-host" is the only host the agent may reach
    Given a suite with the tasks "web-1" and "web-2" and a Harbor that scores every trial
    When the user runs "taskcapture run --suite suite --agent claude-code --model model-a --allow-host llm.example.com"
    Then Harbor ran the job "default" with "--allow-agent-host llm.example.com"

  @id=SCN-TASK-046 @status=implemented
  Scenario: Without "--configuration" the one job is named "default"
    Given a suite with the tasks "web-1" and "web-2" and a Harbor that scores every trial
    When the user runs "taskcapture run --suite suite --agent oracle"
    Then the command exits with code 0
    And Harbor ran 1 job, "default", with the agent "oracle" and no model
    And "report.json" has the cell "default" and "oracle" with correctness 1

  @id=SCN-TASK-047 @status=implemented
  Scenario: A Harbor job that fails exits 1 and writes no report
    Given a suite with the tasks "web-1" and "web-2" and a Harbor that exits with code 3
    When the user runs "taskcapture run --suite suite --agent claude-code --model model-a --configuration v1"
    Then the command exits with code 1
    And the error output says "taskcapture: harbor run for the configuration v1 exited with code 3"
    And the output folder has no file "report.json"

  @id=SCN-TASK-048 @status=implemented
  Scenario: A Harbor that cannot be started exits 1 and says how to install it
    Given a suite with the tasks "web-1" and "web-2" and "TASKCAPTURE_HARBOR" set to a file that does not exist
    When the user runs "taskcapture run --suite suite --agent oracle"
    Then the command exits with code 1
    And the error output says to install Harbor with "uv tool install harbor" or to set "TASKCAPTURE_HARBOR"

  @id=SCN-TASK-049 @status=implemented
  Scenario: Run needs an agent
    When the user runs "taskcapture run --suite suite --model model-a"
    Then the command exits with code 2
    And the error output says "taskcapture: run takes --agent, like --agent claude-code or --agent oracle"

  @id=SCN-TASK-050 @status=implemented
  Scenario: A suite without a task exits 2
    Given an empty folder "suite"
    When the user runs "taskcapture run --suite suite --agent oracle"
    Then the command exits with code 2
    And the error output says "taskcapture: suite holds no Harbor task (a folder with task.toml)"

  @id=SCN-TASK-051 @status=implemented
  Scenario: A configuration name that is not a folder name exits 2
    When the user runs "taskcapture run --suite suite --agent oracle --configuration ../v1"
    Then the command exits with code 2
    And the error output says "taskcapture: --configuration takes a name like v1, or v1=harbor.yaml with a Harbor config file"
