@module=runlog @owner=maintainers
Feature: Prompt content
  Prompts, answers, tool arguments and tool results stay out of the run unless the developer asks for them. With
  --include-content they are added with the GenAI attribute names.

  @id=SCN-RUN-014 @status=implemented @realizes=SCN-FACTORY-DATA-006
  Scenario: The run leaves out prompt content by default
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl"
    Then "runs.jsonl" does not contain the prompt "Fix the failing login test"
    And no span has the attribute "gen_ai.input.messages", "gen_ai.output.messages", "gen_ai.tool.call.arguments" or "gen_ai.tool.call.result"

  @id=SCN-RUN-015 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: --include-content adds the messages and the tool calls
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl --include-content"
    Then the first "chat claude-sonnet-5-5" span has "gen_ai.input.messages" with the user text "Fix the failing login test"
    And the first "execute_tool Bash" span has "gen_ai.tool.call.arguments" "{\"command\":\"npm test\"}" and "gen_ai.tool.call.result" "1 failing"
