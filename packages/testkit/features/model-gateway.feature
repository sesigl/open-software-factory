@module=testkit @owner=maintainers
Feature: Scripted model gateway
  fakes.modelGateway is an OpenAI-compatible endpoint that answers only the calls its script names. A module
  reaches it through the base URL its configuration documents.

  @id=SCN-TK-006 @status=implemented
  Scenario: A scripted model call gets its scripted reply
    Given fakes.modelGateway with the reply "Hello, Ada" for a request that contains "Say hello"
    When a module sends "Say hello" to the chat completions endpoint of the gateway
    Then the reply is "Hello, Ada"

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
    Given fakes.modelGateway with the reply "Hello, Ada" with 1000 prompt tokens and 200 completion tokens for a request that contains "Say hello"
    When a module sends "Say hello" to the chat completions endpoint of the gateway
    Then the reported token usage is 1000 prompt, 200 completion and 1200 total tokens

  @id=SCN-TK-065 @status=implemented
  Scenario: A scripted Messages API call gets its scripted reply
    Given fakes.modelGateway with the reply "Hello, Ada" for a request that contains "Say hello"
    When a module sends "Say hello" to the Anthropic Messages endpoint of the gateway
    Then the text and the stop reason are "Hello, Ada end_turn"

  @id=SCN-TK-066 @status=implemented
  Scenario: A scripted Messages API reply streams a tool call
    Given fakes.modelGateway with the tool call "Write" with the input "{"file_path":"notes.md"}" for a request that contains "fix the typo"
    When a module streams a Messages API call that contains "fix the typo" from the gateway
    Then the tool call and the stop reason are "Write {"file_path":"notes.md"} tool_use"

  @id=SCN-TK-067 @status=implemented
  Scenario: Messages API calls take the scripted replies in order, and the last one answers again
    Given fakes.modelGateway with the replies "first" and "second" for requests that contain "fix the typo"
    When a module sends "fix the typo" to the Anthropic Messages endpoint of the gateway three times
    Then the texts are "first", "second" and "second"

  @id=SCN-TK-068 @status=implemented
  Scenario: A scripted Messages API call that hangs gets no answer
    Given fakes.modelGateway with a reply that hangs for a request that contains "add a date"
    When a module sends "add a date" to the Anthropic Messages endpoint of the gateway and gives up after 500 milliseconds
    Then the module gave up without an answer

  @id=SCN-TK-069 @status=implemented
  Scenario: A scripted Messages API reply ends with its scripted stop reason and token usage
    Given fakes.modelGateway with the stop reason "refusal" with 1000 prompt tokens and 200 completion tokens for a request that contains "Say hello"
    When a module sends "Say hello" to the Anthropic Messages endpoint of the gateway
    Then the stop reason and the token usage are "refusal 1000 200"

  @id=SCN-TK-073 @status=implemented
  Scenario: A scripted Responses API call streams its scripted reply and token usage
    Given fakes.modelGateway with the reply "Hello, Ada" with 1000 prompt tokens and 200 completion tokens for a request that contains "Say hello"
    When a module streams a Responses API call that contains "Say hello" from the gateway
    Then the text and the token usage are "Hello, Ada 1000 200"

  @id=SCN-TK-074 @status=implemented
  Scenario: A scripted Responses API reply streams a function call and a custom tool call
    Given fakes.modelGateway with the tool "exec_command" with the input "{"cmd":"cat notes.md"}" and the tool "apply_patch" with the text input "*** Begin Patch" for a request that contains "fix the typo"
    When a module streams a Responses API call that contains "fix the typo" from the gateway
    Then the output items are "function_call exec_command {"cmd":"cat notes.md"}" and "custom_tool_call apply_patch *** Begin Patch"

  @id=SCN-TK-075 @status=implemented
  Scenario: A scripted Responses API call that hangs gets no answer
    Given fakes.modelGateway with a reply that hangs for a request that contains "add a date"
    When a module sends "add a date" to the Responses API of the gateway and gives up after 500 milliseconds
    Then the module gave up without an answer

  @id=SCN-TK-076 @status=implemented
  Scenario: A streamed chat completions call gets its scripted tool call, finish reason and token usage
    Given fakes.modelGateway with the tool "edit" with the input "{"filePath":"notes.md"}" and 1000 prompt tokens and 200 completion tokens for a request that contains "fix the typo"
    When a module streams a chat completions call that contains "fix the typo" from the gateway
    Then the tool call, the finish reason and the token usage are "edit {"filePath":"notes.md"} tool_calls 1000 200"

  @id=SCN-TK-077 @status=implemented
  Scenario: Streamed chat completions calls take the scripted replies in order, with the scripted finish reason
    Given fakes.modelGateway with the reply "first" and the reply "second" with the finish reason "content_filter" for requests that contain "fix the typo"
    When a module streams a chat completions call that contains "fix the typo" from the gateway twice
    Then the texts and finish reasons are "first stop" and "second content_filter"

  @id=SCN-TK-120 @status=implemented
  Scenario: The model gateway for containers answers a call from a container
    Given a module whose CLI runs curl in a container that sends "hello from a container" to the chat completions API at "DEMO_MODEL_URL" and prints the answer
    And its system test scripts the reply "hello back" for that call, passes the container URL of the model gateway for containers and expects "hello back"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-124 @status=implemented
  Scenario: The model gateway keeps the headers of each call
    Given fakes.modelGateway with a reply for a request that contains "Say hello"
    When a module sends "Say hello" to the chat completions endpoint of the gateway with the header "X-Demo-Key" "k1"
    Then the gateway's call has the header "x-demo-key" "k1"
