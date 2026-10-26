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
