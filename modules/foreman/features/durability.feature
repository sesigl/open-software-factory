@module=foreman @owner=maintainers
Feature: Durability
  The run's history lives in Temporal, so a run survives a restart of the foreman.

  @id=SCN-FORE-021 @status=planned @realizes=SCN-FACTORY-RUNTIME-001
  Scenario: A run goes on from its history after the foreman restarts
    Given a run of the README's factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"
    And the foreman stops and starts again
    When gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate
    Then "/v1/runs/<id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"
    And the harness received the prompt "Write a plan" only once
