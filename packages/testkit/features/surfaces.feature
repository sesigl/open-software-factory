@module=testkit @owner=maintainers
Feature: A module's servers and events
  Besides its CLI, a module can be an HTTP server, an MCP server or a publisher of CloudEvents. The sut starts the
  module's artifact for each of these and talks to it from the outside, as a user or another module would.

  @id=SCN-TK-014 @status=implemented
  Scenario: sut.http starts the module as a server and calls its API
    Given a module whose server answers "GET /greeting" on "PORT" with the JSON text "hello"
    And its system test starts it with sut.http and expects "hello" from the plain and the typed client
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-015 @status=implemented
  Scenario: sut.http shows the server's error output when it exits before it listens
    Given a module whose server prints "port is taken" and exits with code 1
    And its system test starts it with sut.http
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "the server exited with code 1 before it listened on PORT"
    And the output contains "port is taken"

  @id=SCN-TK-054 @status=implemented
  Scenario: sut.http.stop stops the server so the test can start it again with another environment
    Given a module whose server answers "GET /greeting" with the JSON text of "DEMO_GREETING"
    And its system test starts it with "DEMO_GREETING" "hello", stops it, starts it with "hi" and expects "hi"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-016 @status=implemented
  Scenario: sut.mcp connects to the module's MCP server and calls a tool
    Given a module whose MCP server on stdio has the tool "greet" that answers "hello Ada"
    And its system test calls "greet" through sut.mcp and expects "hello Ada"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-017 @status=implemented
  Scenario: sut.events records the CloudEvent a module publishes on NATS
    Given a module whose CLI publishes a "pr.opened" CloudEvent on "osf.events" at "DEMO_NATS_URL"
    And its system test watches fakes.nats with sut.events and expects one "pr.opened" event
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-018 @status=implemented
  Scenario: sut.events names the events that arrived instead of the expected one
    Given a module whose CLI publishes a "run.completed" CloudEvent on "osf.events" at "DEMO_NATS_URL"
    And its system test expects one "pr.opened" event within 500 ms
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "expected 1 event(s) of type pr.opened"
    And the output contains "osf.events: run.completed"
