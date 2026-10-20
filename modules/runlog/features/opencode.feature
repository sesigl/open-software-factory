@module=runlog @owner=maintainers
Feature: Export an OpenCode session
  "runlog export" reads an OpenCode session that "opencode export <session id>" printed as JSON into the same run
  shape as a Claude Code session. The session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy" of the system tests has two
  assistant messages of "claude-sonnet-5-5", an "edit" call and a "bash" call.

  @id=SCN-RUN-022 @status=planned @realizes=SCN-FACTORY-DATA-001
  Scenario: An OpenCode run has the same root span as a Claude Code run
    Given a Git repository with one commit and the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"
    When the developer runs "runlog export session.json"
    Then the command exits with code 0
    And the root span in "runs.jsonl" has "gen_ai.provider.name" "anthropic", "gen_ai.request.model" "claude-sonnet-5-5" and "gen_ai.conversation.id" "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"
    And the root span has "gen_ai.usage.input_tokens" 2800, "gen_ai.usage.output_tokens" 80 and "gen_ai.usage.cache_read.input_tokens" 1600
    And the resource has "osf.harness.name" "opencode" and "osf.harness.version" "1.18.2"

  @id=SCN-RUN-023 @status=planned
  Scenario: Each assistant message of an OpenCode run becomes one chat span
    Given a Git repository with one commit and the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"
    When the developer runs "runlog export session.json"
    Then "runs.jsonl" has 2 spans "chat claude-sonnet-5-5" below the root span
    And the first has "gen_ai.response.id" "msg_a1", "gen_ai.usage.input_tokens" 1300 and "gen_ai.usage.output_tokens" 60

  @id=SCN-RUN-024 @status=planned @realizes=SCN-FACTORY-DATA-001
  Scenario: Each tool part of an OpenCode run becomes one execute_tool span that lasts from its start to its end
    Given a Git repository with one commit and the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"
    When the developer runs "runlog export session.json"
    Then "runs.jsonl" has 1 span "execute_tool edit" and 1 span "execute_tool bash" below the root span
    And the "execute_tool bash" span has "gen_ai.tool.call.id" "toolu_oc2" and lasts 9 seconds
