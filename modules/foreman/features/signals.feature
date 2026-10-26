@module=foreman @owner=maintainers
Feature: Signals
  A person steers or cancels a run through "/v1/runs/<id>/signals".

  @id=SCN-FORE-016 @status=implemented @realizes=SCN-FACTORY-ORCH-006
  Scenario: A steering message reaches the running stage's agent
    Given a run whose stage "implement" runs a turn that waits for "use the existing date helper"
    When a person posts the signal "steer" with the message "use the existing date helper"
    Then the answer has the status 202
    And the agent received the steering message "use the existing date helper"
    And "/v1/runs/<id>" shows the state "complete"

  @id=SCN-FORE-017 @status=implemented @realizes=SCN-FACTORY-ORCH-008
  Scenario: A cancel ends the running stage's turn and the run
    Given a run whose stage "implement" runs a turn that waits for "never"
    When a person posts the signal "cancel"
    Then the answer has the status 202
    And "/v1/runs/<id>" shows the state "cancelled" with the stage "implement" "cancelled"

  @id=SCN-FORE-018 @status=implemented @realizes=SCN-FACTORY-ORCH-008
  Scenario: A cancel ends a run that waits at a gate
    Given a run of the README's factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"
    When a person posts the signal "cancel"
    Then "/v1/runs/<id>" shows the state "cancelled" with the stage "implement" "cancelled"
    And the harness never received the prompt "Implement plan.md"

  @id=SCN-FORE-019 @status=implemented
  Scenario: A signal to a run that ended is refused
    Given the server completed a run of the README's "work.json"
    When a person posts the signal "cancel"
    Then the answer has the status 409 and a problem that names the state "complete"

  @id=SCN-FORE-020 @status=implemented
  Scenario: An unknown signal is refused
    Given the server completed a run of the README's "work.json"
    When a person posts the signal "pause"
    Then the answer has the status 400 and a problem that names "type"

  @id=SCN-FORE-031 @status=implemented @realizes=SCN-FACTORY-ORCH-006
  Scenario: Two steering messages reach the agent once each, in order
    Given a run whose stage "implement" runs a turn that waits for "and add a test"
    When a person posts the signal "steer" with the message "use the existing date helper"
    And after the agent received it, the signal "steer" with the message "and add a test"
    Then the agent received "use the existing date helper" and then "and add a test", each once
