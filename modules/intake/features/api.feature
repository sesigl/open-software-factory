@module=intake @owner=maintainers
Feature: The work item API
  "intake serve" takes submissions over HTTP, turns requests with the same dedupe key into one work item, and shows a
  work item with every request that asked for it (ADR 0063).

  @id=SCN-INTAKE-002 @status=implemented @realizes=SCN-FACTORY-ACCESS-001
  Scenario: A second submission with the same dedupe key is the same work item
    Given the server received the README's "work.json"
    When a program posts a submission with the dedupe key "idea:export-csv" from the origin "slack"
    Then the answer has the status 200 and the same work item ID
    And "/v1/work-items/<id>" lists the requests from "api" and "slack"

  @id=SCN-INTAKE-003 @status=implemented
  Scenario: A submission without a dedupe key takes the link of its origin as the key
    Given the server runs
    When a program posts a submission without "dedupeKey" from the origin "https://github.com/acme/web/issues/42"
    Then the answer has the status 201 and a work item with the dedupe key "https://github.com/acme/web/issues/42"

  @id=SCN-INTAKE-004 @status=implemented
  Scenario: A submission without a dedupe key and without a link or ID of its origin gets the status 400
    Given the server runs
    When a program posts a submission without "dedupeKey" from the origin "api" without a link or ID
    Then the answer has the status 400 and a problem whose detail names the field "dedupeKey"

  @id=SCN-INTAKE-005 @status=implemented
  Scenario: A submission without a title gets the status 400 and names the field
    Given the server runs
    When a program posts a submission without "title" to "/v1/work-items"
    Then the answer has the status 400 and a problem whose detail names the field "title"

  @id=SCN-INTAKE-006 @status=implemented
  Scenario: A call without the API token gets the status 401
    Given the server runs
    When a program posts the README's "work.json" to "/v1/work-items" without the API token
    Then the answer has the status 401

  @id=SCN-INTAKE-007 @status=implemented
  Scenario: A work item the server does not know gets the status 404
    Given the server runs
    When a program gets "/v1/work-items/wi_00000000000000000000"
    Then the answer has the status 404 and a problem whose detail names "wi_00000000000000000000"

  @id=SCN-INTAKE-008 @status=implemented
  Scenario: A work item kept in PostgreSQL is there after the server starts again
    Given the server, with "INTAKE_DATABASE_URL" set to a PostgreSQL database, received the README's "work.json"
    When the server starts again on the same database
    Then "/v1/work-items/<id>" shows the work item with the title "Export reports as CSV"

  @id=SCN-INTAKE-009 @status=implemented
  Scenario: The server without an API token exits with code 2 and names the variable
    Given an empty working folder
    When the user runs "intake serve" without "INTAKE_API_TOKEN"
    Then the command exits with code 2
    And the error output says "set INTAKE_API_TOKEN"

  @id=SCN-INTAKE-029 @status=implemented
  Scenario: A work item is found by its dedupe key
    Given the server received the README's "work.json"
    When a program gets "/v1/work-items?dedupeKey=idea:export-csv"
    Then the answer has the status 200 and the work item with the title "Export reports as CSV"
