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

  @id=SCN-TK-029 @status=implemented
  Scenario: A route with "times" answers only that many requests
    Given a module whose CLI posts {"n":1} to "/v1/traces" at "DEMO_API_URL" twice and prints both status codes
    And its system test scripts "POST /v1/traces" to answer 503 once and then 200, and expects "503 200"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-030 @status=implemented
  Scenario: The fake gives the body of every request it received
    Given a module whose CLI posts {"n":1} to "/v1/traces" at "DEMO_API_URL" twice and prints both status codes
    And its system test expects the fake to have received the body {"n":1} at "POST /v1/traces" twice
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-037 @status=planned
  Scenario: A route with a content type answers its body as is
    Given a module whose CLI gets "/checkout" from the API at "DEMO_API_URL" and prints the content type and the body
    And its system test scripts the answer "<h1>Pay with a card</h1>" with the content type "text/html" for "GET /checkout"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
