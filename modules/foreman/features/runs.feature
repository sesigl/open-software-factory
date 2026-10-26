@module=foreman @owner=maintainers
Feature: Runs
  One run per work item: each stage of the factory's workflow runs its agent through the harness port, one after
  the other.

  @id=SCN-FORE-002 @status=implemented @realizes=SCN-FACTORY-ORCH-001
  Scenario: Each stage's agent gets its prompt and the work item
    Given "foreman serve" runs the README's "factory.yaml" with a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the harness received a prompt with "Write a plan" and "Export reports as CSV"
    And then a prompt with "Implement plan.md" and "Export reports as CSV"

  @id=SCN-FORE-003 @status=implemented
  Scenario: The same work item again is the same run
    Given the server completed a run of the README's "work.json"
    When a program posts the README's "work.json" to "/v1/runs" again
    Then the answer has the status 200 and the same run ID
    And the harness received the prompt "Write a plan" only once

  @id=SCN-FORE-004 @status=implemented
  Scenario: A stage whose turn ends with "refusal" fails the run
    Given "foreman serve" runs the README's "factory.yaml" with a scripted harness that ends the "plan" turn with "refusal"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "failed" with the stage "plan" "failed" and the stage "implement" "pending"
    And the harness never received the prompt "Implement plan.md"

  @id=SCN-FORE-005 @status=implemented
  Scenario: A run the server does not know is 404
    Given "foreman serve" runs the README's "factory.yaml"
    When a program reads "/v1/runs/run_00000000000000000000" with the API token
    Then the answer has the status 404 and a problem that names "run_00000000000000000000"

  @id=SCN-FORE-006 @status=implemented
  Scenario: A call without the API token is refused
    Given "foreman serve" runs the README's "factory.yaml"
    When a program posts the README's "work.json" to "/v1/runs" without a token
    Then the answer has the status 401

  @id=SCN-FORE-007 @status=implemented
  Scenario: A work item without a title is refused
    Given "foreman serve" runs the README's "factory.yaml"
    When a program posts the README's "work.json" without "title" to "/v1/runs" with the API token
    Then the answer has the status 400 and a problem that names "title"

  @id=SCN-FORE-024 @status=implemented
  Scenario: The foreman allows a tool call that the stage's agent asks about
    Given "foreman serve" runs the README's "factory.yaml" with a scripted harness whose "plan" turn asks to edit "plan.md"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the harness shows the tool call "edit plan.md" allowed
    And the run's folder holds the "plan.md" the agent wrote

  @id=SCN-FORE-025 @status=implemented
  Scenario: A stage whose harness does not start fails the run
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_HARNESSES" naming a program that does not exist
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "failed" with the stage "plan" "failed" and the stage "implement" "pending"

  @id=SCN-FORE-028 @status=implemented @realizes=SCN-FACTORY-LOOP-011
  Scenario: A stage's harness session carries the run
    Given "foreman serve" runs the README's "factory.yaml" with "OSF_DATA" set to "$OUTPUT/foreman"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the harness adapter's record of the "plan" session has the run's folder "$OUTPUT/foreman/runs/<id>"
    And its resource attributes name the run, the work item, the stage "plan" and the factory version
