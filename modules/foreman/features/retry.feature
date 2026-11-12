@module=foreman @owner=maintainers
Feature: Run a work item again
  A person runs a run that failed or was cancelled again through "/v1/runs/<id>/retry". The new run has an ID of its
  own, names the run before it, and starts at the first stage that did not succeed (ADR 0105).

  @id=SCN-FORE-088 @status=implemented
  Scenario: A retry of a failed run starts a new run at the stage that failed
    Given the server ran the README's "work.json" and the "implement" turn ended with "refusal"
    When "github:ada" posts a retry of the run to "/v1/runs/<id>/retry"
    Then the answer has the status 201 and a new run ID with the attempt 2, the run before "<id>" and the person "github:ada"
    And "/v1/runs/<new id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"
    And the harness received the prompt "Write a plan" only once and the prompt "Implement plan.md" twice

  @id=SCN-FORE-089 @status=implemented
  Scenario: The new run works in the folder and on the pull request of the run before
    Given the server ran the README's "work.json" with "OSF_DATA" set to "$OUTPUT/foreman", the "plan" turn wrote "plan.md" and replied with the link "https://github.com/tester/web/pull/7", and the "implement" turn ended with "refusal"
    When "github:ada" posts a retry of the run to "/v1/runs/<id>/retry"
    Then the "implement" turn of the new run ran in "$OUTPUT/foreman/runs/<new id>", which holds the "plan.md" of the run before
    And its prompt has the line "Pull request: https://github.com/tester/web/pull/7"

  @id=SCN-FORE-090 @status=implemented
  Scenario: A retry of a cancelled run starts the cancelled stage again
    Given a run whose stage "implement" runs a turn that waits for "never", and a person posted the signal "cancel"
    When "github:ada" posts a retry of the run to "/v1/runs/<id>/retry"
    Then "/v1/runs/<new id>" shows the stage "plan" "succeeded" and the stage "implement" "running"

  @id=SCN-FORE-091 @status=implemented
  Scenario: A retry of a run whose gate was rejected asks gatekeeper again
    Given a run of the README's factory whose gate before the stage "implement" was rejected
    When "github:ada" posts a retry of the run to "/v1/runs/<id>/retry"
    Then gatekeeper received a second request for the stage "implement" of the work item, whose change names the run "<new id>"
    And "/v1/runs/<new id>" shows the state "blocked" with the stage "implement" "blocked"

  @id=SCN-FORE-092 @status=implemented
  Scenario: A retry from an earlier stage runs that stage again
    Given the server ran the README's "work.json" and the "implement" turn ended with "refusal"
    When "github:ada" posts a retry of the run from the stage "plan"
    Then "/v1/runs/<new id>" shows the state "complete"
    And the harness received the prompt "Write a plan" twice

  @id=SCN-FORE-093 @status=implemented
  Scenario: A retry from a stage after the stage that failed is refused
    Given the server ran the README's "work.json" and the "plan" turn ended with "refusal"
    When "github:ada" posts a retry of the run from the stage "implement"
    Then the answer has the status 400 and a problem that names "from" and the stage "plan"

  @id=SCN-FORE-094 @status=implemented
  Scenario: A retry without the person who asks is refused
    Given "foreman serve" runs the README's "factory.yaml"
    When a program posts a retry to "/v1/runs/run_00000000000000000000/retry" without "by"
    Then the answer has the status 400 and a problem that names "by"

  @id=SCN-FORE-095 @status=implemented
  Scenario: A retry of a run that is still going is refused
    Given a run whose stage "implement" runs a turn that waits for "never"
    When "github:ada" posts a retry of the run to "/v1/runs/<id>/retry"
    Then the answer has the status 409 and a problem that names the state "running"
    And "/v1/runs" lists one run

  @id=SCN-FORE-096 @status=implemented
  Scenario: A retry of a run that succeeded is refused
    Given the server completed a run of the README's "work.json"
    When "github:ada" posts a retry of the run to "/v1/runs/<id>/retry"
    Then the answer has the status 409 and a problem that names the state "complete"

  @id=SCN-FORE-097 @status=implemented
  Scenario: A retry of a run the server does not know is 404
    Given "foreman serve" runs the README's "factory.yaml"
    When "github:ada" posts a retry to "/v1/runs/run_00000000000000000000/retry"
    Then the answer has the status 404 and a problem that names "run_00000000000000000000"

  @id=SCN-FORE-098 @status=implemented
  Scenario: Two retries of the same run at the same time start one run
    Given the server ran the README's "work.json" and the "implement" turn ended with "refusal"
    When "github:ada" and "github:ben" post a retry of the run at the same time
    Then one answer has the status 201 and the other the status 409 and a problem that names the new run
    And "/v1/runs" lists two runs

  @id=SCN-FORE-099 @status=implemented
  Scenario: A retry of a run that already ran again is refused and names the later run
    Given the server ran the README's "work.json", the "implement" turn ended with "refusal", and "github:ada" retried the run
    When "github:ben" posts a retry of the first run
    Then the answer has the status 409 and a problem that names the run "<new id>"

  @id=SCN-FORE-100 @status=implemented
  Scenario: The runs list shows the run before and the new run
    Given the server ran the README's "work.json", the "implement" turn ended with "refusal", and "github:ada" retried the run
    When a program reads "/v1/runs" with the API token
    Then the list has the new run in the state "complete" with the attempt 2, and then the run before in the state "failed"

  @id=SCN-FORE-101 @status=implemented
  Scenario: The same work item again answers the newest run
    Given the server ran the README's "work.json", the "implement" turn ended with "refusal", and "github:ada" retried the run
    When a program posts the README's "work.json" to "/v1/runs" again
    Then the answer has the status 200 and the run ID "<new id>"

  @id=SCN-FORE-102 @status=planned
  Scenario: The new run publishes its events with its own IDs and the run before
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server, and its run of the README's "work.json" failed in the stage "implement"
    When "github:ada" posts a retry of the run to "/v1/runs/<id>/retry"
    Then the server publishes "run.started@v1" with the ID "<new id>.started" and the "retryOf" "<id>"
    And then "run.completed@v1" with the ID "<new id>.completed", the outcome "succeeded" and the "retryOf" "<id>"

  @id=SCN-FORE-103 @status=implemented
  Scenario: A gate decision reaches the newest run of the work item
    Given a run of the README's factory whose gate before the stage "implement" was rejected, and its retry waits at the gate "g9f8e7d6c5b4a3f2e"
    When gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate "g9f8e7d6c5b4a3f2e" of the work item
    Then "/v1/runs/<new id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"

  @id=SCN-FORE-104 @status=planned
  Scenario: A retry request from intake runs the work item again
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server, and its run of the README's "work.json" failed in the stage "implement"
    When intake publishes "work.retry-requested@v1" for the run with the requester "github:tester"
    Then the server publishes "run.started@v1" of a new run with the "retryOf" "<id>"
    And "/v1/runs/<new id>" names the person "github:tester" who retried it

  @id=SCN-FORE-105 @status=planned
  Scenario: A second retry request for the same run starts no third run
    Given the foreman ran the README's "work.json" again after intake's "work.retry-requested@v1" for its failed run
    When intake publishes the same "work.retry-requested@v1" again after the duplicate window
    Then the server warns that the run "<id>" already ran again as "<new id>"
    And "/v1/runs" lists two runs

  @id=SCN-FORE-106 @status=implemented
  Scenario: The new run gets its own key with the factory's budget
    Given "foreman serve" runs the README's "gateway/factory.yaml" with a fake inference adapter as "litellm", and its run of the README's "work.json" failed in the stage "implement"
    When "github:ada" posts a retry of the run to "/v1/runs/<id>/retry"
    Then the inference adapter made a second key, with the new run's ID and the budget "5"

  @id=SCN-FORE-107 @status=implemented
  Scenario: The new run has a trace of its own that names the run before
    Given "foreman serve" runs the README's "factory.yaml" with an OTLP receiver, and its run of the README's "work.json" failed in the stage "implement"
    When "github:ada" posts a retry of the run to "/v1/runs/<id>/retry"
    Then the receiver got the new run's span in a trace other than the first run's, with the attribute "osf.run.retry_of" "<id>"

  @id=SCN-FORE-108 @status=implemented
  Scenario: The first stage of the new run is told why the run before ended
    Given the server ran the README's "checks/factory.yaml", the check "verify" before the stage "ship" ended with "failure", and then a person set it to "success"
    When "github:ada" posts a retry of the run from the stage "implement"
    Then the "implement" prompt of the new run has the line "Run before: <id> failed in the stage ship: the check verify ended with failure"
    And no later prompt of the new run has a line that starts with "Run before:"

  @id=SCN-FORE-109 @status=implemented
  Scenario: A retry after the factory's stages changed starts at the first stage
    Given the server ran the README's "work.json" with "OSF_DATA" set to "$OUTPUT/foreman", the "plan" turn wrote "plan.md" and replied with the link "https://github.com/tester/web/pull/7", and the "implement" turn ended with "refusal"
    And a new commit adds the stage "review" to "factory.yaml", so the stage names in order are no longer those of the run
    When "github:ada" posts a retry of the run to "/v1/runs/<id>/retry"
    Then the answer has the status 201 with the stages "plan", "implement" and "review" "pending" and the pull request "https://github.com/tester/web/pull/7"
    And the "plan" prompt of the new run has the line "Run before: <id> failed in the stage implement"
    And the "plan" turn of the new run ran in "$OUTPUT/foreman/runs/<new id>", which holds the "plan.md" of the run before

  @id=SCN-FORE-110 @status=implemented
  Scenario: A retry from a later stage after the factory's stages changed is refused
    Given the server ran the README's "work.json" and the "implement" turn ended with "refusal"
    And a new commit adds the stage "review" to "factory.yaml", so the stage names in order are no longer those of the run
    When "github:ada" posts a retry of the run from the stage "implement"
    Then the answer has the status 409 and a problem that says the factory's stages changed and the new run starts at the stage "plan"
    And "/v1/runs" lists one run

  @id=SCN-FORE-111 @status=implemented
  Scenario: A retry from a stage the run does not have is refused
    Given the server ran the README's "work.json" and the "implement" turn ended with "refusal"
    When "github:ada" posts a retry of the run from the stage "implemnt"
    Then the answer has the status 400 and a problem that names "from" and says the run has no stage "implemnt"
