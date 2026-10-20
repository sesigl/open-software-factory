@module=runlog @owner=maintainers
Feature: Agent Trace line attribution
  With --agent-trace <file>, export and attach write an Agent Trace record (version 0.1.0) of the lines the session
  wrote and link it from the root span. runlog finds the text of each write in the file as it is now in the current
  folder and records its line ranges with the contributor "ai" and the model.

  @id=SCN-RUN-037 @status=implemented
  Scenario: The lines a Claude Code session wrote are attributed to its model
    Given a Git repository with one commit, the file "src/login.ts" and a Claude Code session that edited lines 3 to 4 of "src/login.ts" and wrote "src/logout.ts" with 3 lines
    When the developer runs "runlog export session.jsonl --agent-trace trace.json"
    Then the command exits with code 0
    And "trace.json" is an Agent Trace record with version "0.1.0" and the Git revision of the repository
    And it attributes lines 3 to 4 of "src/login.ts" and lines 1 to 3 of "src/logout.ts" to "ai" with the model "anthropic/claude-sonnet-5-5"

  @id=SCN-RUN-038 @status=implemented
  Scenario: The lines a Codex patch added are attributed to its model
    Given a Git repository with one commit, the file "src/session.ts" and a Codex session whose patch added its 2 lines
    When the developer runs "runlog export rollout.jsonl --agent-trace trace.json"
    Then the command exits with code 0
    And "trace.json" attributes lines 1 to 2 of "src/session.ts" to "ai" with the model "openai/gpt-5-codex"

  @id=SCN-RUN-039 @status=implemented
  Scenario: The lines an OpenCode edit wrote are attributed to its model
    Given a Git repository with one commit, the file "src/login.ts" and the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy" that edited lines 3 to 4 of it
    When the developer runs "runlog export session.json --agent-trace trace.json"
    Then the command exits with code 0
    And "trace.json" attributes lines 3 to 4 of "src/login.ts" to "ai" with the model "anthropic/claude-sonnet-5-5"

  @id=SCN-RUN-040 @status=implemented
  Scenario: The root span links the Agent Trace record
    Given a Git repository with one commit, the file "src/login.ts" and a Claude Code session that edited lines 3 to 4 of "src/login.ts" and wrote "src/logout.ts" with 3 lines
    When the developer runs "runlog export session.jsonl --agent-trace trace.json"
    Then the root span in "runs.jsonl" has "osf.agent_trace.uri" set to the file URL of "trace.json"

  @id=SCN-RUN-041 @status=implemented
  Scenario: Text that the session wrote and a person changed later is not attributed
    Given a Git repository with one commit, the file "src/login.ts" without the lines a Claude Code session wrote into it
    When the developer runs "runlog export session.jsonl --agent-trace trace.json"
    Then the command exits with code 0
    And "trace.json" has no file "src/login.ts"
