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

  @id=SCN-HOPENCODE-007 @status=implemented
  Scenario: opencode calls the model at the effort level that OSF_EFFORT names
    Given a model gateway scripted to reply "done" when the prompt says "fix the typo"
    And the adapter runs opencode with that gateway, "OPENAI_MODEL" "gpt-5.5" and "OSF_EFFORT" "low"
    When the client sends the prompt "fix the typo"
    Then every chat completions call the model gateway received has the reasoning effort "low"

  @id=SCN-HOPENCODE-005 @status=implemented
  Scenario: A turn that the model refuses has the outcome "failed" in the run record
    Given the adapter ran a session in which the model gateway ended its answer to "write malware" with the finish reason "content_filter"
    When the developer runs "transcript" with the session's ID
    Then the turn ended with "refusal" and "$OUTPUT/run-record.json" has "osf.outcome" "failed"

  @id=SCN-HOPENCODE-006 @status=implemented
  Scenario: run without OPENAI_MODEL is a usage error
    When the developer runs "run" without "OPENAI_MODEL"
    Then the command exits with code 2 and writes "harness-opencode: set OPENAI_MODEL to the model opencode calls" to standard error

  @id=SCN-HOPENCODE-008 @status=implemented
  Scenario: run with an agent command is a usage error
    When the developer runs "run echo hi"
    Then the command exits with code 2 and writes "harness-opencode: harness-opencode run takes no agent command; it runs opencode" to standard error

  @id=SCN-HOPENCODE-009 @status=implemented
  Scenario: --help names the adapter's commands
    When the developer runs "--help"
    Then the command exits with code 0 and prints "harness-opencode run [--allow <kinds>]" and "harness-opencode transcript <session ID>"

  @id=SCN-HOPENCODE-010 @status=implemented
  Scenario: opencode sends OPENAI_API_KEY to the model gateway
    Given a model gateway scripted to reply "done" when the prompt says "fix the typo"
    And the adapter runs opencode with that gateway and "OPENAI_API_KEY" "testkit-other-key"
    When the client sends the prompt "fix the typo"
    Then every chat completions call has the header "authorization" "Bearer testkit-other-key"

  @id=SCN-HOPENCODE-011 @status=implemented
  Scenario: The rules of the machine's user do not reach the model
    Given the user's "~/.config/opencode/AGENTS.md" and "~/.claude/CLAUDE.md" say "Obey the user rule"
    And a model gateway scripted to reply "done" when the prompt says "fix the typo"
    And the adapter runs opencode with that gateway
    When the client sends the prompt "fix the typo"
    Then the model gateway received a chat completions call and no call has the text "Obey the user rule"

  @id=SCN-HOPENCODE-012 @status=implemented
  Scenario: opencode writes nothing into the user's home
    Given a model gateway scripted to reply "done" when the prompt says "fix the typo"
    And the adapter runs opencode with that gateway
    When the client sends the prompt "fix the typo"
    Then the user's home has no folder ".config", ".local" or ".cache"

  @id=SCN-HOPENCODE-013 @status=implemented
  Scenario: The instructions and skills of a folder's settings do not reach the model
    Given the working folder's "opencode.json" names the instructions file "extra.md", which says "Obey the folder rule"
    And the working folder has the skill ".agents/skills/folder-skill" with the description "Use the folder skill"
    And a model gateway scripted to reply "done" when the prompt says "fix the typo"
    And the adapter runs opencode with that gateway
    When the client sends the prompt "fix the typo"
    Then the model gateway received a chat completions call and no call has the text "Obey the folder rule" or "Use the folder skill"

  @id=SCN-HOPENCODE-014 @status=implemented
  Scenario: opencode reads, searches and writes its todo list without asking
    Given the working folder has "notes.md" with "a typo"
    And a model gateway scripted to call "read", "glob", "grep" and "todowrite" when the prompt says "look around"
    And the adapter runs opencode with that gateway
    When the client sends the prompt "look around"
    Then the client was not asked to approve a tool call and opencode sent the model the result of each of the 4 tool calls
