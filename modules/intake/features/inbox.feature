@module=intake @owner=maintainers
Feature: The inbox
  "/v1/inbox" lists the latest work items, the one received last first, so a person sees the work that waits.

  @id=SCN-INTAKE-046 @status=implemented @realizes=SCN-FACTORY-ACCESS-003
  Scenario: The inbox lists the work items, the one received last first
    Given the server received the README's "work.json" at "2026-01-01T00:00:00Z"
    And it received a submission with the title "Import reports from CSV" at "2026-01-01T00:05:00Z"
    When a program reads "/v1/inbox" with the API token
    Then the answer lists the work items "Import reports from CSV" and "Export reports as CSV", in this order, each with its status "received"

  @id=SCN-INTAKE-047 @status=implemented
  Scenario: The inbox lists only the work items in the status the query names
    Given the server, with "INTAKE_NATS_URL" set to a NATS server, received the README's "work.json"
    And the foreman published "run.started@v1" for the work item
    And the server received a submission with the title "Import reports from CSV"
    When a program reads "/v1/inbox?status=running" with the API token
    Then the answer lists only the work item "Export reports as CSV"

  @id=SCN-INTAKE-048 @status=implemented
  Scenario: The inbox refuses a status that no work item can have
    Given the server runs
    When a program reads "/v1/inbox?status=merged" with the API token
    Then the answer has the status 400 and a problem that names "status"
