@module=foreman @owner=maintainers
Feature: The run list
  "/v1/runs" lists the server's runs with their views, and a person filters them by state (ADR 0071).

  @id=SCN-FORE-064 @status=implemented @realizes=SCN-FACTORY-ORCH-008
  Scenario: A person lists the runs of the server
    Given the server completed the runs of the README's "work.json" and of the work item "Import reports from CSV"
    When a program reads "/v1/runs" with the API token
    Then the answer lists both runs in the state "complete", each with its work item's title

  @id=SCN-FORE-065 @status=implemented @realizes=SCN-FACTORY-ORCH-008
  Scenario: A person filters the runs by state
    Given the server completed the run of the README's "work.json" and failed the run of "Import reports from CSV"
    When a program reads "/v1/runs?state=failed" with the API token
    Then the answer lists only the run of "Import reports from CSV"

  @id=SCN-FORE-066 @status=implemented
  Scenario: A state that no run can have is refused
    Given "foreman serve" runs the README's "factory.yaml"
    When a program reads "/v1/runs?state=done" with the API token
    Then the answer has the status 400 and a problem that names "state"

  @id=SCN-FORE-067 @status=implemented @realizes=SCN-FACTORY-ORCH-008
  Scenario: A run that waits at its gate is listed as blocked
    Given a run of the README's "work.json" waits at the gate before "implement"
    When a program reads "/v1/runs?state=blocked" with the API token
    Then the answer lists the run in the state "blocked" with the stage "implement" "blocked"
