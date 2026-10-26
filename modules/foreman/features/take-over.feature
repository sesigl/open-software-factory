@module=foreman @owner=maintainers
Feature: Take over
  A person takes over the running stage of a run through "/v1/runs/<id>/signals": the foreman ends the agent's turn,
  keeps the stage's files in the run's folder and waits. The person works in that folder and hands the run back; the
  stage counts as succeeded and the next stage starts from the person's files (ADR 0070).

  @id=SCN-FORE-058 @status=planned @realizes=SCN-FACTORY-ORCH-007
  Scenario: A person takes over the running stage
    Given a run whose stage "implement" runs a turn that waits for "never"
    When a person posts the signal "take-over"
    Then the answer has the status 202
    And "/v1/runs/<id>" shows the state "blocked" with the stage "implement" "blocked" and a time "takenOverAt"
    And it shows the run's folder "$OUTPUT/foreman/runs/<id>" with the file "plan.md" the stage "plan" wrote

  @id=SCN-FORE-059 @status=planned @realizes=SCN-FACTORY-ORCH-007
  Scenario: The next stage starts from the files of the person who handed the run back
    Given a person took over the stage "plan" of a run of the README's "sandboxed/factory.yaml" with a fake sandbox adapter
    And the person wrote "plan.md" in the run's folder
    When the person posts the signal "hand-back"
    Then the stage "plan" is "succeeded" and the stage "implement" ran in a sandbox that held "plan.md"
    And "/v1/runs/<id>" shows the state "complete"

  @id=SCN-FORE-060 @status=planned
  Scenario: A take-over ends the stage's sandbox
    Given a run of the README's "sandboxed/factory.yaml" whose stage "plan" writes "draft.md" in its sandbox and waits for "never"
    When a person posts the signal "take-over" and the stage is "blocked"
    Then the run's folder holds "draft.md"
    And the sandbox adapter's list is empty

  @id=SCN-FORE-061 @status=planned
  Scenario: A take-over of a run without a running stage is refused
    Given a run of the README's factory waits at the gate "g0a1b2c3d4e5f6a7b" before the stage "implement"
    When a person posts the signal "take-over"
    Then the answer has the status 409 and a problem that says no stage is running

  @id=SCN-FORE-062 @status=planned
  Scenario: A hand-back of a run nobody took over is refused
    Given a run whose stage "implement" runs a turn that waits for "never"
    When a person posts the signal "hand-back"
    Then the answer has the status 409 and a problem that says nobody took over the run

  @id=SCN-FORE-063 @status=planned @realizes=SCN-FACTORY-ORCH-008
  Scenario: A cancel ends a run a person took over
    Given a person took over the stage "implement" of a run
    When a person posts the signal "cancel"
    Then "/v1/runs/<id>" shows the state "cancelled" with the stage "implement" "cancelled"
