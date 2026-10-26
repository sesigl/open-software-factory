@module=foreman @owner=maintainers
Feature: Factory definition
  The foreman reads the factory's "factory.yaml" when a run starts. The run keeps that version of the factory until
  it ends.

  @id=SCN-FORE-008 @status=planned @realizes=SCN-FACTORY-LOOP-011
  Scenario: A run carries the commit of the factory definition
    Given the README's "factory.yaml" is committed in the factory's repository
    And "foreman serve" runs it with a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the factory "hello" and that commit as the factory version

  @id=SCN-FORE-009 @status=planned @realizes=SCN-FACTORY-LOOP-011
  Scenario: A run keeps its factory version when the factory changes during the run
    Given a run of the README's factory waits at a gate before the stage "implement"
    And a new commit adds the stage "review" to "factory.yaml"
    When gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate
    Then the run completes with the stages "plan" and "implement" and the first commit as its factory version

  @id=SCN-FORE-010 @status=planned
  Scenario: A stage that names an unknown agent stops the server at the start
    Given a "factory.yaml" whose stage "review" names the agent "reviewer", which the factory does not declare
    When the user runs "foreman serve"
    Then the command exits with code 2
    And the output contains "factory.yaml: /workflow/0/agent: no agent \"reviewer\""

  @id=SCN-FORE-011 @status=planned
  Scenario: The server needs an API token
    Given the README's "factory.yaml"
    When the user runs "foreman serve" without "FOREMAN_API_TOKEN"
    Then the command exits with code 2
    And the output contains "FOREMAN_API_TOKEN"
