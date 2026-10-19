@module=testkit @owner=maintainers
Feature: Scripted HTTP API
  fakes.http is a JSON API on 127.0.0.1 that answers only the routes its script names (ADR 0021). A module reaches
  it through the base URL its configuration documents.

  @id=SCN-TK-027 @status=implemented
  Scenario: A scripted route gets its scripted answer
    Given a module whose CLI gets "/v0.1/servers?search=tracker" from the API at "DEMO_API_URL" and prints the body
    And its system test scripts the answer {"count":1} for "GET /v0.1/servers?search=tracker"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-028 @status=implemented
  Scenario: An unscripted request fails the test with the request shown
    Given a module whose CLI gets "/v0.1/servers?search=tracker" from the API at "DEMO_API_URL" and prints the body
    And its system test scripts no route
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "unscripted HTTP request: GET /v0.1/servers?search=tracker"
