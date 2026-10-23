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

  @id=SCN-TK-042 @status=implemented
  Scenario: A scripted reply reports its token usage
    Given a module whose CLI sends "Say hello" to the chat completions endpoint at "DEMO_MODEL_URL" and prints the reported token usage
    And its system test scripts the reply "Hello, Ada" with 1000 prompt tokens and 200 completion tokens
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-065 @status=implemented
  Scenario: A scripted Messages API call gets its scripted reply
    Given a module whose CLI sends "Say hello" to the Anthropic Messages endpoint at "DEMO_ANTHROPIC_URL" and prints the text and the stop reason
    And its system test scripts the reply "Hello, Ada" for a request that contains "Say hello" and expects "Hello, Ada end_turn"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-066 @status=implemented
  Scenario: A scripted Messages API reply streams a tool call
    Given a module whose CLI streams a Messages API call that contains "fix the typo" from "DEMO_ANTHROPIC_URL" and prints each tool call and the stop reason
    And its system test scripts the tool call "Write" with the input "{"file_path":"notes.md"}" and expects "Write {"file_path":"notes.md"} tool_use"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-067 @status=implemented
  Scenario: Messages API calls take the scripted replies in order, and the last one answers again
    Given a module whose CLI sends "fix the typo" to the Anthropic Messages endpoint at "DEMO_ANTHROPIC_URL" three times and prints each text
    And its system test scripts the replies "first" and "second" for requests that contain "fix the typo" and expects "first", "second" and "second"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-068 @status=implemented
  Scenario: A scripted Messages API call that hangs gets no answer
    Given a module whose CLI sends "add a date" to the Anthropic Messages endpoint at "DEMO_ANTHROPIC_URL", gives up after 500 milliseconds and prints "gave up"
    And its system test scripts a reply that hangs for a request that contains "add a date" and expects "gave up"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-069 @status=implemented
  Scenario: A scripted Messages API reply ends with its scripted stop reason and token usage
    Given a module whose CLI sends "Say hello" to the Anthropic Messages endpoint at "DEMO_ANTHROPIC_URL" and prints the stop reason and the token usage
    And its system test scripts the stop reason "refusal" with 1000 prompt tokens and 200 completion tokens and expects "refusal 1000 200"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-073 @status=implemented
  Scenario: A scripted Responses API call streams its scripted reply and token usage
    Given a module whose CLI streams a Responses API call that contains "Say hello" from "DEMO_MODEL_URL" and prints the text and the token usage
    And its system test scripts the reply "Hello, Ada" with 1000 prompt tokens and 200 completion tokens and expects "Hello, Ada 1000 200"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-074 @status=implemented
  Scenario: A scripted Responses API reply streams a function call and a custom tool call
    Given a module whose CLI streams a Responses API call that contains "fix the typo" from "DEMO_MODEL_URL" and prints each output item
    And its system test scripts the tool "exec_command" with the input "{"cmd":"cat notes.md"}" and the tool "apply_patch" with the text input "*** Begin Patch", and expects "function_call exec_command {"cmd":"cat notes.md"}" and "custom_tool_call apply_patch *** Begin Patch"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-075 @status=implemented
  Scenario: A scripted Responses API call that hangs gets no answer
    Given a module whose CLI sends "add a date" to the Responses API at "DEMO_MODEL_URL", gives up after 500 milliseconds and prints "gave up"
    And its system test scripts a reply that hangs for a request that contains "add a date" and expects "gave up"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-076 @status=implemented
  Scenario: A streamed chat completions call gets its scripted tool call, finish reason and token usage
    Given a module whose CLI streams a chat completions call that contains "fix the typo" from "DEMO_MODEL_URL" and prints each tool call, the finish reason and the token usage
    And its system test scripts the tool "edit" with the input "{"filePath":"notes.md"}" and 1000 prompt tokens and 200 completion tokens, and expects "edit {"filePath":"notes.md"} tool_calls 1000 200"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-077 @status=implemented
  Scenario: Streamed chat completions calls take the scripted replies in order, with the scripted finish reason
    Given a module whose CLI streams a chat completions call that contains "fix the typo" from "DEMO_MODEL_URL" twice and prints each text and finish reason
    And its system test scripts the reply "first" and the reply "second" with the finish reason "content_filter" for requests that contain "fix the typo", and expects "first stop" and "second content_filter"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
