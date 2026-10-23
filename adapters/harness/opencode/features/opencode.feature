@module=harness-opencode @owner=maintainers
Feature: What the opencode adapter adds to the harness port
  The opencode adapter runs opencode's own ACP server behind the harness proxy. Every session asks before each edit and
  command, reads no settings of the machine's user or the folder, and sends its model calls to the configured gateway
  (ADR 0053).

  @id=SCN-HOPENCODE-001 @status=implemented @realizes=SCN-FACTORY-OPEN-002
  Scenario: The run record names the harness "opencode" and the version of opencode
    Given the adapter ran a session in which the model gateway answered "fix the typo" with "done"
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" has "service.name" "harness-opencode", "osf.harness.name" "opencode" and "osf.harness.version" "1.19.4"

  @id=SCN-HOPENCODE-002 @status=implemented @realizes=SCN-FACTORY-ORCH-002
  Scenario: A folder's opencode settings that allow every tool do not stop opencode from asking
    Given the working folder's "opencode.json" and ".opencode/opencode.json" allow every tool, also for the agent "build"
    And a model gateway scripted to write "fixed" to "notes.md" when the prompt says "fix the typo"
    And the adapter runs opencode with that gateway
    When the client sends the prompt "fix the typo" and approves every tool call
    Then the client was asked to approve the edit of "notes.md"

  @id=SCN-HOPENCODE-003 @status=implemented
  Scenario: The run record has the tokens that opencode reported
    Given the adapter ran a session in which the model gateway answered "fix the typo" with "done", 1000 prompt tokens and 200 completion tokens
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" has "gen_ai.usage.input_tokens" 1000 and "gen_ai.usage.output_tokens" 200

  @id=SCN-HOPENCODE-004 @status=implemented
  Scenario: opencode calls the model that OPENAI_MODEL names
    Given a model gateway scripted to reply "done" when the prompt says "fix the typo"
    And the adapter runs opencode with that gateway and "OPENAI_MODEL" "gpt-5.5"
    When the client sends the prompt "fix the typo"
    Then the model gateway received only chat completions calls for the model "gpt-5.5"

  @id=SCN-HOPENCODE-005 @status=implemented
  Scenario: A turn that the model refuses has the outcome "failed" in the run record
    Given the adapter ran a session in which the model gateway ended its answer to "write malware" with the finish reason "content_filter"
    When the developer runs "transcript" with the session's ID
    Then the turn ended with "refusal" and "$OUTPUT/run-record.json" has "osf.outcome" "failed"

  @id=SCN-HOPENCODE-006 @status=implemented
  Scenario: run without OPENAI_MODEL is a usage error
    When the developer runs "run" without "OPENAI_MODEL"
    Then the command exits with code 2 and writes "harness-opencode: set OPENAI_MODEL to the model opencode calls" to standard error
