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

  @id=SCN-FORE-087 @status=implemented @realizes=SCN-FACTORY-RUNTIME-001
  Scenario: A stage that runs a turn when the foreman stops runs its turn again when the foreman starts again
    Given a run whose stage "implement" runs a turn that waits for "never"
    When the foreman stops and starts again
    Then within 20 seconds the harness received the prompt "Implement plan.md" a second time
    And "/v1/runs/<id>" shows the stage "implement" "running"

  @id=SCN-FORE-179 @status=implemented @realizes=SCN-FACTORY-RUNTIME-001
  Scenario: A stage whose sandbox takes longer to create than the heartbeat timeout sends its prompt once
    Given "foreman serve" runs the stage "plan" of the README's "sandboxed/factory.yaml" with "FOREMAN_HEARTBEAT_TIMEOUT_MS" set to "500" and a fake sandbox adapter whose create takes 800 milliseconds
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "complete"
    And the harness received the prompt "Write a plan" only once
    And the sandbox adapter created 1 sandbox

  @id=SCN-FORE-180 @status=implemented @realizes=SCN-FACTORY-RUNTIME-001
  Scenario: A stage whose folder takes longer to copy out of its sandbox than the heartbeat timeout sends its prompt once
    Given "foreman serve" runs the stage "plan" of the README's "sandboxed/factory.yaml" with "FOREMAN_HEARTBEAT_TIMEOUT_MS" set to "500" and a fake sandbox adapter whose copy out of a sandbox takes 800 milliseconds
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "complete"
    And the harness received the prompt "Write a plan" only once

  @id=SCN-FORE-181 @status=implemented
  Scenario: A cancel while a stage's sandbox is created stops the stage before its prompt
    Given a run of the README's "sandboxed/factory.yaml" whose "plan" stage creates its sandbox with a fake sandbox adapter whose create takes 1 second
    When a program posts the signal "cancel" to "/v1/runs/<id>/signals" while the sandbox is created
    Then "/v1/runs/<id>" shows the state "cancelled" with the stage "plan" "cancelled"
    And the harness never received the prompt "Write a plan"
    And the sandbox adapter's sandbox list is empty

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

  @id=SCN-FORE-182 @status=implemented @realizes=SCN-FACTORY-RUNTIME-001
  Scenario: A work item that comes while the factory's Git remote cannot be fetched comes again and starts its run once it can
    Given "foreman serve" runs with "FOREMAN_FACTORY" set to "git+<url>" of the README's "factory.yaml" and "FOREMAN_NATS_URL" set to a NATS server
    And the Git remote is gone
    When intake publishes "work.received@v1" with the README's "work.json"
    And the Git remote is back
    Then within 20 seconds the server publishes "run.started@v1" for the work item
    And it warned about "osf.work.received.v1" that "FOREMAN_FACTORY: cannot fetch HEAD", for the delivery 1 of 5

  @id=SCN-FORE-184 @status=implemented
  Scenario: A work item that comes while the factory has changes that are not committed comes again and starts its run once they are committed
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    And "agents/plan.md" gets a change that is not committed
    When intake publishes "work.received@v1" with the README's "work.json"
    And the change is committed
    Then within 20 seconds the server publishes "run.started@v1" for the work item
    And it warned about "osf.work.received.v1" that "commit the changed files agents/plan.md", for the delivery 1 of 5

  @id=SCN-FORE-185 @status=implemented
  Scenario: A port that another program listens on ends "foreman serve" with code 1
    Given another program listens on a port
    When the user runs "foreman serve" with "PORT" set to that port, "FOREMAN_TEMPORAL_ADDRESS" set to Temporal and "FOREMAN_NATS_URL" set to a NATS server
    Then the command exits with code 1
    And the output contains "listen EADDRINUSE"

  @id=SCN-FORE-083 @status=implemented
  Scenario: A work item that breaks its contract and a gate decision for no run are one warning each and come no second time
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    When intake publishes "work.received@v1" with a work item without a title
    And gatekeeper publishes "gate.decided@v1" for a work item that has no run
    Then after 4 seconds the server warned once about "osf.work.received.v1", that the body is not a work item
    And it warned once about "osf.gate.decided.v1"

  @id=SCN-FORE-147 @status=implemented
  Scenario: A work item that failed 5 times waits as a dead letter, fails "/v1/health" while it waits, and "foreman resend" starts its run
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    And the file "factory.yaml" is gone
    When intake publishes "work.received@v1" with the README's "work.json"
    Then within 15 seconds "/v1/health" answers 503 with the check "nats" failing for 1 dead letter
    When the file "factory.yaml" is back and the user runs "foreman resend" with "FOREMAN_NATS_URL" set to the NATS server
    Then it prints "resent osf.work.received.v1" and "foreman resent 1 dead letters"
    And within 20 seconds the server publishes "run.started@v1" for the work item, and "/v1/health" answers 200

  @id=SCN-FORE-148 @status=implemented
  Scenario: The foreman adds the stream "OSF" with the max age of "OSF_STREAM_MAX_AGE"
    Given a NATS server without the stream "OSF"
    When "foreman serve" starts with "FOREMAN_NATS_URL" set to the NATS server and "OSF_STREAM_MAX_AGE" set to "7d"
    Then the stream "OSF" keeps an event at most 7 days
