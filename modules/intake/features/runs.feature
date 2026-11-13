@module=intake @owner=maintainers
Feature: A work item follows its run
  The server listens for the foreman's "run.started@v1" and "run.completed@v1", and a work item's status follows its
  run (ADR 0071).

  @id=SCN-INTAKE-030 @status=implemented @realizes=SCN-FACTORY-ACCESS-003
  Scenario: A work item whose run started is running
    Given the server, with "INTAKE_NATS_URL" set to a NATS server, received the README's "work.json"
    When the foreman publishes "run.started@v1" for the work item with the run "run_5d41402abc4b2a76b971"
    Then "/v1/work-items/<id>" shows the status "running" and the run "run_5d41402abc4b2a76b971"

  @id=SCN-INTAKE-031 @status=implemented
  Scenario: A work item whose run succeeded is complete
    Given the server, with "INTAKE_NATS_URL" set to a NATS server, received the README's "work.json"
    When the foreman publishes "run.completed@v1" for the work item with the outcome "succeeded"
    Then "/v1/work-items/<id>" shows the status "complete"

  @id=SCN-INTAKE-032 @status=implemented
  Scenario: A work item whose run failed is failed
    Given the server, with "INTAKE_NATS_URL" set to a NATS server, received the README's "work.json"
    When the foreman publishes "run.completed@v1" for the work item with the outcome "failed"
    Then "/v1/work-items/<id>" shows the status "failed"

  @id=SCN-INTAKE-033 @status=implemented
  Scenario: A late "run.started@v1" leaves a completed work item complete
    Given the server knows that the run of the README's "work.json" completed with the outcome "succeeded"
    When the foreman's "run.started@v1" for that run arrives after it
    Then "/v1/work-items/<id>" still shows the status "complete"

  @id=SCN-INTAKE-038 @status=implemented
  Scenario: A "run.completed@v1" that breaks its contract changes nothing
    Given the server, with "INTAKE_NATS_URL" set to a NATS server, received the README's "work.json"
    When the foreman publishes "run.completed@v1" for the work item with the outcome "merged"
    Then "/v1/work-items/<id>" still shows the status "received"

  @id=SCN-INTAKE-039 @status=implemented @realizes=SCN-FACTORY-ACCESS-003
  Scenario: The Slack thread of a work item links the pull request of its finished run
    Given the server, with "INTAKE_NATS_URL" set to a NATS server and the Slack channel adapter, made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"
    When the foreman publishes "run.completed@v1" for the work item with the outcome "succeeded" and the pull request "https://github.com/acme/web/pull/7"
    Then the thread has the replies "Received as work item <id>." and "Pull request: https://github.com/acme/web/pull/7"

  @id=SCN-INTAKE-040 @status=implemented
  Scenario: A run's start adds no reply to the Slack thread, only its pull request does
    Given the server, with "INTAKE_NATS_URL" set to a NATS server and the Slack channel adapter, made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"
    When the foreman publishes "run.started@v1" for the work item, then "run.completed@v1" with the outcome "succeeded" and the pull request "https://github.com/acme/web/pull/8"
    Then the thread has the replies "Received as work item <id>." and "Pull request: https://github.com/acme/web/pull/8"

  @id=SCN-INTAKE-043 @status=implemented @realizes=SCN-FACTORY-RUNTIME-001
  Scenario: A run event of a time when the server was down reaches the work item when the server starts again
    Given the server, with "INTAKE_NATS_URL" set to a NATS server and "INTAKE_DATABASE_URL" set to a PostgreSQL database, received the README's "work.json"
    And the server stops
    When the foreman publishes "run.completed@v1" for the work item with the outcome "succeeded"
    And the server starts again
    Then "/v1/work-items/<id>" shows the status "complete"

  @id=SCN-INTAKE-049 @status=implemented
  Scenario: A run event that breaks its contract is a warning and comes again after 2 seconds
    Given the server, with "INTAKE_NATS_URL" set to a NATS server, received the README's "work.json"
    When the foreman publishes "run.completed@v1" for the work item with the outcome "merged"
    Then within 10 seconds the server warns twice about "osf.run.completed.v1", for the delivery 1 and 2 of 5

  @id=SCN-INTAKE-057 @status=implemented
  Scenario: The Slack thread of a work item names the stage its run failed at and links the run in the console
    Given the server, with "INTAKE_NATS_URL" set to a NATS server, "INTAKE_CONSOLE_URL" set to "https://console.example" and the Slack channel adapter, made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"
    When the foreman publishes "run.completed@v1" for the work item with the outcome "failed" at the stage "implement"
    Then the thread has the replies "Received as work item <id>." and "The run ended with the outcome failed at the stage implement: https://console.example/runs/run_5d41402abc4b2a76b971"

  @id=SCN-INTAKE-058 @status=implemented
  Scenario: The Slack thread of a work item hears once that its run waits at a gate
    Given the server, with "INTAKE_NATS_URL" set to a NATS server, "INTAKE_CONSOLE_URL" set to "https://console.example" and the Slack channel adapter, made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"
    And the foreman published "run.started@v1" for the work item with the run "run_5d41402abc4b2a76b971"
    When the gatekeeper publishes "gate.requested@v1" for the work item at the stage "deploy" with the summary "Deploy to production?" twice, then the foreman publishes "run.completed@v1" with the outcome "failed"
    Then the thread has the replies "Received as work item <id>.", "The run waits for a decision at the stage deploy: Deploy to production? https://console.example/runs/run_5d41402abc4b2a76b971" and "The run ended with the outcome failed: https://console.example/runs/run_5d41402abc4b2a76b971"
