@module=harness-claude-code @owner=maintainers
Feature: What the claude-code adapter adds to the harness port
  The claude-code adapter runs Claude Code through its ACP bridge behind the harness proxy. Every session asks before
  each edit and command, reads no settings of the machine's user, and sends its model calls to the configured gateway
  (ADR 0051).

  @id=SCN-HCLAUDE-001 @status=implemented @realizes=SCN-FACTORY-OPEN-002
  Scenario: The run record names the harness "claude-code" and the version of its ACP bridge
    Given the adapter ran a session in which the model gateway answered "fix the typo" with "done"
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" has "service.name" "harness-claude-code", "osf.harness.name" "claude-code" and "osf.harness.version" "0.94.0"

  @id=SCN-HCLAUDE-002 @status=implemented @realizes=SCN-FACTORY-ORCH-002
  Scenario: Settings in the home folder do not stop Claude Code from asking
    Given the settings in the home folder set the default mode "acceptEdits"
    And a model gateway scripted to write "fixed" to "notes.md" when the prompt says "fix the typo"
    And the adapter runs Claude Code with that gateway
    When the client sends the prompt "fix the typo" in a session in "$INPUT/app" and approves every tool call
    Then the client was asked to approve "Write notes.md"

  @id=SCN-HCLAUDE-003 @status=implemented
  Scenario: The run record has the tokens and the cost that Claude Code reported
    Given the adapter ran a session in which the model gateway answered "fix the typo" with "done", 1000 prompt tokens and 200 completion tokens
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" has "gen_ai.usage.input_tokens" 1000 and "gen_ai.usage.output_tokens" 200
    And its "osf.cost.usd" is the last cost in "$OUTPUT/transcript.jsonl", above 0

  @id=SCN-HCLAUDE-004 @status=implemented
  Scenario: Claude Code calls the model that ANTHROPIC_MODEL names
    Given a model gateway scripted to reply "done" when the prompt says "fix the typo"
    And the adapter runs Claude Code with that gateway and "ANTHROPIC_MODEL" "claude-sonnet-5-5"
    When the client sends the prompt "fix the typo"
    Then the model gateway received a Messages API call for the model "claude-sonnet-5-5"
