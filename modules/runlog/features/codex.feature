@module=runlog @owner=maintainers
Feature: Export a Codex session
  "runlog export" reads a Codex rollout file (~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*.jsonl) into the same
  run shape as a Claude Code session. The session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69" of the system tests has two
  responses of "gpt-5-codex" and one "shell" call.

  @id=SCN-RUN-008 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: A Codex run has the same root span as a Claude Code run
    Given a Git repository with one commit and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"
    When the developer runs "runlog export rollout.jsonl"
    Then the command exits with code 0
    And the root span in "runs.jsonl" has "gen_ai.provider.name" "openai", "gen_ai.request.model" "gpt-5-codex" and "gen_ai.conversation.id" "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"
    And the root span has "gen_ai.usage.input_tokens" 2600, "gen_ai.usage.output_tokens" 100 and "gen_ai.usage.cache_read.input_tokens" 1300
    And the resource has "osf.harness.name" "codex" and "osf.harness.version" "0.50.0"

  @id=SCN-RUN-009 @status=implemented
  Scenario: Each model response of a Codex run becomes one chat span
    Given a Git repository with one commit and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"
    When the developer runs "runlog export rollout.jsonl"
    Then "runs.jsonl" has 2 spans "chat gpt-5-codex" below the root span
    And the second has "gen_ai.usage.input_tokens" 1400 and "gen_ai.usage.output_tokens" 60

  @id=SCN-RUN-010 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: Each tool call of a Codex run becomes one execute_tool span
    Given a Git repository with one commit and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"
    When the developer runs "runlog export rollout.jsonl"
    Then "runs.jsonl" has 1 span "execute_tool shell" below the root span
    And it has "gen_ai.tool.call.id" "call_01" and lasts 8 seconds
