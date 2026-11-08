@module=foreman @owner=maintainers
Feature: Durability
  The run's history lives in Temporal, so a run survives a restart of the foreman.

  @id=SCN-FORE-021 @status=implemented @realizes=SCN-FACTORY-RUNTIME-001
  Scenario: A run goes on from its history after the foreman restarts
    Given a run of the README's factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"
    And the foreman stops and starts again
    When gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate
    Then "/v1/runs/<id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"
    And the harness received the prompt "Write a plan" only once

  @id=SCN-FORE-073 @status=implemented @realizes=SCN-FACTORY-RUNTIME-001
  Scenario: A work item that intake publishes while the foreman is down starts a run when the foreman starts again
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    And the foreman stops
    When intake publishes "work.received@v1" with the README's "work.json"
    And the foreman starts again
    Then "/v1/runs/<id>" of the work item's run shows the state "complete"

  @id=SCN-FORE-074 @status=implemented @realizes=SCN-FACTORY-RUNTIME-001
  Scenario: A gate decision that gatekeeper publishes while the foreman is down reaches the run when the foreman starts again
    Given a run of the README's factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"
    And the foreman stops
    When gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate
    And the foreman starts again
    Then "/v1/runs/<id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"

  @id=SCN-FORE-082 @status=implemented
  Scenario: A work item that the foreman cannot start for a moment comes again and starts its run
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    And the file "factory.yaml" is gone
    When intake publishes "work.received@v1" with the README's "work.json"
    And the file "factory.yaml" is back
    Then within 20 seconds the server publishes "run.started@v1" for the work item
    And it warned once about "osf.work.received.v1", for the delivery 1 of 5, and about no other subject

  @id=SCN-FORE-083 @status=implemented
  Scenario: A work item that breaks its contract is one warning and comes no second time
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    When intake publishes "work.received@v1" with a work item without a title
    Then after 7 seconds the server warned once about "osf.work.received.v1", that the body is not a work item

  @id=SCN-FORE-084 @status=implemented
  Scenario: A gate decision for a run that does not exist is one warning and comes no second time
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    When gatekeeper publishes "gate.decided@v1" for a work item that has no run
    Then after 7 seconds the server warned once about "osf.gate.decided.v1"
