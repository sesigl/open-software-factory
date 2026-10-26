@module=foreman @owner=maintainers
Feature: Events
  With "FOREMAN_NATS_URL", the foreman starts a run for each "work.received@v1" and publishes "run.started@v1" and
  "run.completed@v1".

  @id=SCN-FORE-022 @status=implemented @realizes=SCN-FACTORY-ORCH-001
  Scenario: A work item from intake starts a run
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    When intake publishes "work.received@v1" with the README's "work.json"
    Then the server publishes "run.started@v1" for the work item with the stages "plan" and "implement"
    And "/v1/runs/<id>" of that run shows the state "complete"

  @id=SCN-FORE-023 @status=implemented
  Scenario: A run that ends publishes its outcome and its factory version
    Given "foreman serve" runs the committed README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the server publishes "run.completed@v1" with the outcome "succeeded", the requester and that commit as the factory version

  @id=SCN-FORE-027 @status=implemented
  Scenario: An event without a valid work item starts no run
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    When intake publishes "work.received@v1" with a work item without a title
    And then "work.received@v1" with the README's "work.json"
    Then the run of the README's work item completes
    And the harness received the prompt "Write a plan" only once

  @id=SCN-FORE-029 @status=implemented
  Scenario: A run that fails publishes the outcome "failed" and the stage that failed
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server and a scripted harness that ends the "plan" turn with "refusal"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the server publishes "run.completed@v1" with the outcome "failed" and the stage "plan"

  @id=SCN-FORE-030 @status=implemented
  Scenario: A cancelled run publishes the outcome "cancelled"
    Given a run of the README's factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"
    When a person posts the signal "cancel"
    Then the server publishes "run.completed@v1" with the outcome "cancelled" and the stage "implement"
