@module=runlog @owner=maintainers
Feature: Collector config pack
  "runlog collector <harness>" writes the OpenTelemetry Collector config of a harness to $OUTPUT/collector.yaml. A
  Collector with that config renames the native spans of the harness to the spans "runlog export" writes. The system
  tests run the real Collector with the config, send the native spans of the harness to it, and read what it exports
  to OTEL_EXPORTER_OTLP_ENDPOINT.

  @id=SCN-RUN-044 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: A Claude Code interaction becomes the root span "invoke_agent"
    Given a Collector with the config that "runlog collector claude-code" wrote
    When Claude Code sends the span "claude_code.interaction" of the session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" to the Collector
    Then the Collector exports the span "invoke_agent" with "gen_ai.operation.name" "invoke_agent" and "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    And the exported resource has "osf.harness.name" "claude-code"

  @id=SCN-RUN-045 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: A Claude Code model request becomes a chat span with its token usage
    Given a Collector with the config that "runlog collector claude-code" wrote
    When Claude Code sends the span "claude_code.llm_request" of "claude-sonnet-5-5" with 1200 input, 300 output and 800 cache read tokens to the Collector
    Then the Collector exports the span "chat claude-sonnet-5-5" with "gen_ai.operation.name" "chat" and "gen_ai.request.model" "claude-sonnet-5-5"
    And the exported span has "gen_ai.usage.input_tokens" 1200, "gen_ai.usage.output_tokens" 300 and "gen_ai.usage.cache_read.input_tokens" 800

  @id=SCN-RUN-046 @status=implemented
  Scenario: A Claude Code tool span becomes an execute_tool span
    Given a Collector with the config that "runlog collector claude-code" wrote
    When Claude Code sends the span "claude_code.tool" of the tool "Bash" with the call "toolu_01" to the Collector
    Then the Collector exports the span "execute_tool Bash" with "gen_ai.tool.name" "Bash" and "gen_ai.tool.call.id" "toolu_01"

  @id=SCN-RUN-047 @status=implemented @realizes=SCN-FACTORY-DATA-006
  Scenario: The Claude Code config drops the prompt text
    Given a Collector with the config that "runlog collector claude-code" wrote
    When Claude Code sends the span "claude_code.interaction" with the "user_prompt" "fix the login bug" to the Collector
    Then the Collector exports the span "invoke_agent" without the attribute "user_prompt"

  @id=SCN-RUN-048 @status=implemented
  Scenario: The launch attributes of a harness pass through the Collector
    Given a Collector with the config that "runlog collector claude-code" wrote
    When Claude Code sends the span "claude_code.interaction" with the resource "osf.run.id" "run-7" and "osf.harness.name" "claude-code-sdk" to the Collector
    Then the exported resource has "osf.run.id" "run-7" and "osf.harness.name" "claude-code-sdk"

  @id=SCN-RUN-049 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: A Codex session loop becomes the root span "invoke_agent"
    Given a Collector with the config that "runlog collector codex" wrote
    When Codex sends the span "session_loop" with "conversation.id" "019a2b3c-4d5e-7f60-8a9b-0c1d2e3f4a5b" to the Collector
    Then the Collector exports the span "invoke_agent" with "gen_ai.operation.name" "invoke_agent" and "gen_ai.conversation.id" "019a2b3c-4d5e-7f60-8a9b-0c1d2e3f4a5b"
    And the exported resource has "osf.harness.name" "codex"

  @id=SCN-RUN-050 @status=implemented
  Scenario: A Codex response handler becomes a chat span
    Given a Collector with the config that "runlog collector codex" wrote
    When Codex sends the span "handle_responses" to the Collector
    Then the Collector exports the span "chat" with "gen_ai.operation.name" "chat"

  @id=SCN-RUN-051 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: An OpenCode model call becomes a chat span with its token usage
    Given a Collector with the config that "runlog collector opencode" wrote
    When OpenCode sends the span "ai.streamText.doStream" of "claude-sonnet-5-5" with 2800 input and 80 output tokens to the Collector
    Then the Collector exports the span "chat claude-sonnet-5-5" with "gen_ai.operation.name" "chat" and "gen_ai.request.model" "claude-sonnet-5-5"
    And the exported span has "gen_ai.usage.input_tokens" 2800 and "gen_ai.usage.output_tokens" 80
    And the exported resource has "osf.harness.name" "opencode"

  @id=SCN-RUN-052 @status=implemented
  Scenario: An OpenCode step becomes the root span "invoke_agent"
    Given a Collector with the config that "runlog collector opencode" wrote
    When OpenCode sends the span "ai.streamText" of the provider "anthropic.messages" to the Collector
    Then the Collector exports the span "invoke_agent" with "gen_ai.operation.name" "invoke_agent" and "gen_ai.provider.name" "anthropic.messages"

  @id=SCN-RUN-053 @status=implemented
  Scenario: An OpenCode tool call becomes an execute_tool span without its arguments
    Given a Collector with the config that "runlog collector opencode" wrote
    When OpenCode sends the span "ai.toolCall" of the tool "bash" with the call "call_01" and the arguments "{\"command\":\"ls\"}" to the Collector
    Then the Collector exports the span "execute_tool bash" with "gen_ai.tool.name" "bash" and "gen_ai.tool.call.id" "call_01"
    And the exported span has no attribute "ai.toolCall.args"

  @id=SCN-RUN-054 @status=implemented
  Scenario: The Collector config of an unknown harness is refused
    Given an empty output folder
    When the developer runs "runlog collector gemini"
    Then the command exits with code 2
    And the output contains "unknown harness gemini: use claude-code, codex or opencode"
    And the output folder has no "collector.yaml"
