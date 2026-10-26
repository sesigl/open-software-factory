@module=foreman @owner=maintainers
Feature: Runs
  One run per work item: each stage of the factory's workflow runs its agent through the harness port, one after
  the other.

  @id=SCN-FORE-002 @status=planned @realizes=SCN-FACTORY-ORCH-001
  Scenario: Each stage's agent gets its prompt and the work item
    Given "foreman serve" runs the README's "factory.yaml" with a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the harness received a prompt with "Write a plan" and "Export reports as CSV"
    And then a prompt with "Implement plan.md" and "Export reports as CSV"

  @id=SCN-FORE-003 @status=planned
  Scenario: The same work item again is the same run
    Given the server completed a run of the README's "work.json"
    When a program posts the README's "work.json" to "/v1/runs" again
    Then the answer has the status 200 and the same run ID
    And the harness received the prompt "Write a plan" only once

  @id=SCN-FORE-004 @status=planned
  Scenario: A stage whose turn ends with "refusal" fails the run
    Given "foreman serve" runs the README's "factory.yaml" with a scripted harness that ends the "plan" turn with "refusal"
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "failed" with the stage "plan" "failed" and the stage "implement" "pending"
    And the harness never received the prompt "Implement plan.md"

  @id=SCN-FORE-005 @status=planned
  Scenario: A run the server does not know is 404
    Given "foreman serve" runs the README's "factory.yaml"
    When a program reads "/v1/runs/run_00000000000000000000" with the API token
    Then the answer has the status 404 and a problem that names "run_00000000000000000000"

  @id=SCN-FORE-006 @status=planned
  Scenario: A call without the API token is refused
    Given "foreman serve" runs the README's "factory.yaml"
    When a program posts the README's "work.json" to "/v1/runs" without a token
    Then the answer has the status 401

  @id=SCN-FORE-007 @status=planned
  Scenario: A work item without a title is refused
    Given "foreman serve" runs the README's "factory.yaml"
    When a program posts the README's "work.json" without "title" to "/v1/runs" with the API token
    Then the answer has the status 400 and a problem that names "title"
