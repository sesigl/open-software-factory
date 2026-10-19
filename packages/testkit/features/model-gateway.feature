@module=testkit @owner=maintainers
Feature: Scripted model gateway
  fakes.modelGateway is an OpenAI-compatible endpoint that answers only the calls its script names. A module
  reaches it through the base URL its configuration documents.

  @id=SCN-TK-006 @status=implemented
  Scenario: A scripted model call gets its scripted reply
    Given a module whose CLI sends "Say hello" to the chat completions endpoint at "DEMO_MODEL_URL" and prints the reply
    And its system test scripts the reply "Hello, Ada" for a request that contains "Say hello"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-007 @status=implemented
  Scenario: An unscripted model call fails the test with the request shown
    Given a module whose CLI sends "Say hello" to the chat completions endpoint at "DEMO_MODEL_URL" and prints the reply
    And its system test scripts no reply
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "unscripted model call: POST /v1/chat/completions"
    And the output contains "Say hello"
