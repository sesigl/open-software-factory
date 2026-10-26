@module=intake @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README: submit work over HTTP and read it back, with no database.

  @id=SCN-INTAKE-001 @status=implemented @realizes=SCN-FACTORY-LOOP-001 @realizes=SCN-FACTORY-ACCESS-002
  Scenario: A program submits work over HTTP and reads it back
    Given "intake serve" runs with the README's "INTAKE_API_TOKEN" and no database
    When a program posts the README's "work.json" to "/v1/work-items" with the API token
    Then the answer has the status 201 and a work item "wi_" in the state "received"
    And "/v1/work-items/<id>" shows the work item with the title "Export reports as CSV" from the origin "api"
