@module=testkit @owner=maintainers
Feature: Scripted HTTP API
  fakes.http is a JSON API on 127.0.0.1 that answers only the routes its script names (ADR 0021). A module reaches
  it through the base URL its configuration documents.

  @id=SCN-TK-027 @status=implemented
  Scenario: A scripted route gets its scripted answer
    Given fakes.http with the answer {"count":1} for "GET /v0.1/servers?search=tracker"
    When a module gets "/v0.1/servers?search=tracker" from the fake
    Then the body is {"count":1}

  @id=SCN-TK-028 @status=implemented
  Scenario: An unscripted request fails the test with the request shown
    Given a module whose CLI gets "/v0.1/servers?search=tracker" from the API at "DEMO_API_URL" and prints the body
    And its system test scripts no route
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "unscripted HTTP request: GET /v0.1/servers?search=tracker"

  @id=SCN-TK-029 @status=implemented
  Scenario: A route with "times" answers only that many requests
    Given fakes.http with "POST /v1/traces" scripted to answer 503 once and then 200
    When a module posts {"n":1} to "/v1/traces" of the fake twice
    Then the status codes are "503 200"

  @id=SCN-TK-126 @status=implemented
  Scenario: A route with "until" answers only after its promise settles
    Given fakes.http that holds the answer {"count":0} for "GET /v0.1/servers?search=tracker" until a promise settles
    When a module gets "/v0.1/servers?search=tracker" from the fake, and the test changes the answer to {"count":1} once the fake has the request, then settles the promise
    Then the body is {"count":1}

  @id=SCN-TK-030 @status=implemented
  Scenario: The fake gives the body of every request it received
    Given fakes.http with the route "POST /v1/traces"
    When a module posts {"n":1} to "/v1/traces" of the fake twice
    Then the fake has received the body {"n":1} at "POST /v1/traces" twice

  @id=SCN-TK-037 @status=implemented
  Scenario: A route with a content type answers its body as is
    Given fakes.http with the answer "<h1>Pay with a card</h1>" with the content type "text/html" for "GET /checkout"
    When a module gets "/checkout" from the fake
    Then the content type and the body are "text/html <h1>Pay with a card</h1>"

  @id=SCN-TK-043 @status=implemented
  Scenario: The fake gives the headers of every request it received
    Given fakes.http with the route "POST /v1/traces"
    When a module posts {"n":1} to "/v1/traces" of the fake with the header "authorization" set to "Bearer demo"
    Then the fake has received the header "authorization" with "Bearer demo" at "POST /v1/traces"

  @id=SCN-TK-078 @status=implemented
  Scenario: A fake for containers answers a request from a container
    Given a module whose CLI runs curl in a container for "/v0.1/servers?search=tracker" at "DEMO_API_URL" and prints the body
    And its system test scripts {"count":1} for that path on a fake for containers and passes its container URL
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-083 @status=implemented
  Scenario: The fake gives the text of each request body as it arrived
    Given fakes.http with the route "POST /v1/hooks"
    When a module posts the body '{ "n": 1 }' with its spaces to "/v1/hooks" of the fake
    Then "texts" of the fake gives '{ "n": 1 }' for that request
