@module=foreman @owner=maintainers
Feature: Gates
  A stage with a gate asks gatekeeper for a decision before it starts. The run is "blocked" until a
  "gate.decided@v1" event for that gate arrives.

  @id=SCN-FORE-012 @status=implemented @realizes=SCN-FACTORY-ORCH-003
  Scenario: A stage with a gate asks gatekeeper and the run waits
    Given the README's factory with a gate before the stage "implement"
    And gatekeeper answers a request with the gate "g0a1b2c3d4e5f6a7b"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then gatekeeper received a request for the stage "implement" of the work item with the summary "Export reports as CSV: start the stage implement"
    And "/v1/runs/<id>" shows the state "blocked" with the stage "plan" "succeeded" and the stage "implement" "blocked"
    And the harness never received the prompt "Implement plan.md"

  @id=SCN-FORE-013 @status=implemented @realizes=SCN-FACTORY-ORCH-003
  Scenario: An approval of the gate starts the stage
    Given a run of the README's factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"
    When gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate
    Then "/v1/runs/<id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"

  @id=SCN-FORE-014 @status=implemented @realizes=SCN-FACTORY-ORCH-003
  Scenario: A rejection of the gate fails the run
    Given a run of the README's factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"
    When gatekeeper publishes "gate.decided@v1" with the decision "rejected" for the gate
    Then "/v1/runs/<id>" shows the state "failed" with the stage "implement" "rejected"
    And the harness never received the prompt "Implement plan.md"

  @id=SCN-FORE-015 @status=implemented
  Scenario: A decision for another gate does not start the stage
    Given a run of the README's factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"
    When gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate "g9f8e7d6c5b4a3f2e" of the same work item
    And then "gate.decided@v1" with the decision "rejected" for the gate "g0a1b2c3d4e5f6a7b"
    Then "/v1/runs/<id>" shows the state "failed" with the stage "implement" "rejected"
    And the harness never received the prompt "Implement plan.md"

  @id=SCN-FORE-072 @status=implemented
  Scenario: A gate request links the run's pull request
    Given the README's factory with a gate before the stage "implement", whose "plan" turn replies with the link "https://github.com/tester/web/pull/7"
    And gatekeeper answers a request with the gate "g0a1b2c3d4e5f6a7b"
    When a program posts the README's "work.json" with the origin "https://github.com/tester/web/issues/3" to "/v1/runs"
    Then gatekeeper received a request for the stage "implement" with the links "Origin" and "Pull request", in this order
