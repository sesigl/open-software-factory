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

  @id=SCN-RUN-015 @status=deprecated @realizes=SCN-FACTORY-DATA-001
  Scenario: --include-content adds the messages and the tool calls
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl --include-content"
    Then the first "chat claude-sonnet-5-5" span has "gen_ai.input.messages" with the user text "Fix the failing login test"
    And the first "execute_tool Bash" span has "gen_ai.tool.call.arguments" "{\"command\":\"npm test\"}" and "gen_ai.tool.call.result" "1 failing"

  @id=SCN-RUN-063 @status=implemented @replaces=SCN-RUN-015 @realizes=SCN-FACTORY-DATA-001
  Scenario: --include-content adds every message and every tool call of a Claude Code run
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl --include-content"
    Then the 3 "chat claude-sonnet-5-5" spans have the input messages [user "Fix the failing login test"], [] and []
    And they have the output messages [assistant "I will run the tests."], [] and [assistant "Opened the pull request."]
    And the 2 "execute_tool Bash" spans have the arguments "{\"command\":\"npm test\"}" and "{\"command\":\"gh pr create --fill\"}"
    And they have the results "1 failing" and "https://github.com/acme/web/pull/7" with its line break

  @id=SCN-RUN-064 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: --include-content adds every message and every tool call of a Codex run
    Given a Git repository with one commit and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"
    When the developer runs "runlog export rollout.jsonl --include-content"
    Then the 2 "chat gpt-5-codex" spans have the input messages [user "Fix the failing login test"] and []
    And they have the output messages [] and [assistant "Fixed the test."]
    And the "execute_tool shell" span has the arguments "{\"command\":[\"npm\",\"test\"]}" and the result "1 failing"
    And the "execute_tool apply_patch" span has the patch that adds "src/session.ts" as its arguments and the result "Success."

  @id=SCN-RUN-065 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: --include-content adds every message and every tool call of an OpenCode run
    Given a Git repository with one commit and the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"
    When the developer runs "runlog export session.json --include-content"
    Then the 2 "chat claude-sonnet-5-5" spans have the input messages [user "Fix the failing login test"] and []
    And they have the output messages [assistant "I will fix the test and run it."] and [assistant "The test passes now."]
    And the "execute_tool bash" span has the arguments "{\"command\":\"npm test\"}" and the result "1 passing"
    And the "execute_tool read" span, whose call failed, has the result "File not found"
