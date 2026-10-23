@module=harness-codex @owner=maintainers
Feature: What the codex adapter adds to the harness port
  The codex adapter runs Codex through its ACP bridge behind the harness proxy. Every session runs in Codex's mode
  read-only, reads no settings of the machine's user, and sends its model calls to the configured gateway (ADR 0053).

  @id=SCN-HCODEX-001 @status=implemented @realizes=SCN-FACTORY-OPEN-002
  Scenario: The run record names the harness "codex" and the version of its ACP bridge
    Given the adapter ran a session in which the model gateway answered "fix the typo" with "done"
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" has "service.name" "harness-codex", "osf.harness.name" "codex" and "osf.harness.version" "2.2.2"

  @id=SCN-HCODEX-002 @status=implemented @realizes=SCN-FACTORY-ORCH-002
  Scenario: A command that Codex runs without asking cannot write in the working folder
    Given a model gateway scripted to run the command "touch made.txt" when the prompt says "make a file"
    And the adapter runs Codex with that gateway
    When the client sends the prompt "make a file" and approves every tool call
    Then the client was not asked to approve a tool call
    And Codex sent the model a failed command and "$INPUT/made.txt" does not exist

  @id=SCN-HCODEX-003 @status=implemented
  Scenario: The run record has the tokens that Codex reported
    Given the adapter ran a session in which the model gateway answered "fix the typo" with "done", 1000 prompt tokens and 200 completion tokens
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" has "gen_ai.usage.input_tokens" 1000 and "gen_ai.usage.output_tokens" 200

  @id=SCN-HCODEX-004 @status=implemented
  Scenario: Codex calls the model that OPENAI_MODEL names, not the one in the folder's settings
    Given the working folder's ".codex/config.toml" names the model "gpt-folder"
    And a model gateway scripted to reply "done" when the prompt says "fix the typo"
    And the adapter runs Codex with that gateway and "OPENAI_MODEL" "gpt-5.5"
    When the client sends the prompt "fix the typo"
    Then the model gateway received a Responses API call for the model "gpt-5.5"

  @id=SCN-HCODEX-005 @status=implemented @realizes=SCN-FACTORY-OPEN-006
  Scenario: A folder's settings cannot send Codex's model calls to another provider
    Given the working folder's ".codex/config.toml" names the model provider "other" with a second model gateway
    And a model gateway scripted to reply "done" when the prompt says "fix the typo"
    And the adapter runs Codex with that gateway
    When the client sends the prompt "fix the typo"
    Then the scripted model gateway answered the call and the second one received none
