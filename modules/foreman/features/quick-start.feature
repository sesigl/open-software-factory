@module=foreman @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README: run a factory of two stages for one work item, with a scripted
  harness and the Temporal dev server.

  @id=SCN-FORE-001 @status=implemented @realizes=SCN-FACTORY-ORCH-001 @realizes=SCN-FACTORY-E2E-001
  Scenario: A program starts a run of the README's factory and it completes
    Given "foreman serve" runs the README's "factory.yaml" with a scripted harness that ends every turn
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then the answer has the status 201 and a run "run_" in the state "running"
    And "/v1/runs/<id>" shows the state "complete" with the stages "plan" and "implement" "succeeded"
