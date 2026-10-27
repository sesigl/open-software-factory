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

  @id=SCN-TK-056 @status=implemented
  Scenario: sut.acp starts the module as an ACP agent and sends a prompt in a session
    Given a module whose ACP agent on stdio answers "greet Ada" with "hello Ada from" and the name of the session's folder
    And its system test starts a session in "$INPUT/work" with sut.acp, sends "greet Ada" and expects "end_turn" with the reply "hello Ada from work"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-057 @status=implemented
  Scenario: sut.acp refuses the agent's tool calls when asked to and lists them
    Given a module whose ACP agent asks to approve the tool "rm -rf build" for "clean up" and replies with the option the client chose
    And its system test connects with sut.acp and "approve: false", sends "clean up" and expects the reply "reject" and one request for "rm -rf build"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-058 @status=implemented
  Scenario: sut.acp cancels the running turn of a session
    Given a module whose ACP agent keeps the turn of "wait" running until the session is cancelled
    And its system test sends "wait" with sut.acp, cancels the session and expects "cancelled"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-064 @status=implemented
  Scenario: sut.acp gives the exit code of a module that exits
    Given a module whose ACP agent exits with code 3 after its answer to the prompt "bye"
    And its system test sends "bye" with sut.acp and expects the exit code 3
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-071 @status=implemented
  Scenario: sut.acp.serve connects to an ACP agent that runs in the test's own process
    Given a library whose exported function serves an ACP agent on the streams it gets and answers "greet Ada" with "hello Ada"
    And its system test serves that function with sut.acp.serve, sends "greet Ada" and expects "end_turn" with the reply "hello Ada"
    When the developer runs "testkit run --junit report.xml" in the library
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

  @id=SCN-TK-114 @status=implemented
  Scenario: sut.compose starts a Compose file of the module and reaches the port a service publishes
    Given a module whose "compose.yaml" has the service "events", a NATS server that publishes its port 8222
    And its system test runs "up --detach --wait" with sut.compose, reads "/healthz" at the URL of "events" port 8222 and expects "ok"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-115 @status=implemented
  Scenario: sut.helm installs a chart of the module in the scenario's namespace and reaches the port of a service
    Given a module whose chart "chart" has the service "events", a NATS server on port 8222
    And its system test runs "install events chart --wait" with sut.helm, reads "/healthz" at the URL of "events" port 8222 and expects "ok"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
