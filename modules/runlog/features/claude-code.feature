@module=runlog @owner=maintainers
Feature: Export a Claude Code session
  "runlog export" reads a Claude Code session file (~/.claude/projects/<project>/<session>.jsonl) and writes the run
  as OTLP: a root span "invoke_agent", one "chat" span per model response and one "execute_tool" span per tool call.
  The session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" of the system tests has three responses of
  "claude-sonnet-5-5"; Claude Code writes the first one on two lines, a text and a tool call.

  @id=SCN-RUN-003 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: The root span of a Claude Code run carries the model and the token usage of the whole session
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl"
    Then the command exits with code 0
    And the root span in "runs.jsonl" has "gen_ai.provider.name" "anthropic" and "gen_ai.request.model" "claude-sonnet-5-5"
    And the root span has "gen_ai.usage.input_tokens" 7400, "gen_ai.usage.output_tokens" 150 and "gen_ai.usage.cache_read.input_tokens" 3000

  @id=SCN-RUN-004 @status=implemented
  Scenario: Each model response of a Claude Code run becomes one chat span
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl"
    Then "runs.jsonl" has 3 spans "chat claude-sonnet-5-5" below the root span
    And the first has "gen_ai.response.id" "msg_01", "gen_ai.usage.input_tokens" 1500 and "gen_ai.usage.output_tokens" 50

  @id=SCN-RUN-005 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: Each tool call of a Claude Code run becomes one execute_tool span that lasts until its result
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl"
    Then "runs.jsonl" has 2 spans "execute_tool Bash" below the root span
    And the first has "gen_ai.tool.call.id" "toolu_01" and lasts 14 seconds

  @id=SCN-RUN-006 @status=implemented @realizes=SCN-FACTORY-DATA-003
  Scenario: A pull request link that a tool printed ends up on the root span
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl"
    Then the root span in "runs.jsonl" has "osf.pull_request.urls" ["https://github.com/acme/web/pull/7"]

  @id=SCN-RUN-007 @status=implemented
  Scenario: A second export appends a second run to runs.jsonl
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    And the developer ran "runlog export session.jsonl"
    When the developer runs "runlog export session.jsonl" again
    Then "runs.jsonl" has 2 lines with the same trace ID
