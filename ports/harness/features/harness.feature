@port=harness @owner=maintainers
Feature: Running a coding agent through a harness adapter
  A harness adapter is a program that speaks the Agent Client Protocol (ACP) on stdio. Its client starts it, opens
  sessions and sends prompts as to any ACP agent. The adapter runs the harness behind it and adds the factory's
  rules: a tool allowlist, cancel within 5 seconds, and a transcript in the run record shape (ADR 0050).

  @id=SCN-HARNESS-001 @status=implemented @conformance @realizes=SCN-FACTORY-OPEN-002
  Scenario: A session starts in a working folder and edits a file on request
    Given a harness scripted to write "fixed" to "notes.md" and reply "done" when the prompt says "fix the typo"
    And the adapter runs that harness
    When the client starts a session in "$INPUT/app" and sends the prompt "fix the typo"
    Then the turn ends with "end_turn" and the reply "done"
    And "$INPUT/app/notes.md" says "fixed"

  @id=SCN-HARNESS-002 @status=implemented @conformance @realizes=SCN-FACTORY-ORCH-002
  Scenario: A tool call outside the allowlist is refused without asking the client
    Given a harness scripted to run the tool "rm -rf build" of kind "execute" when the prompt says "clean up"
    And the adapter runs that harness with the allowlist "read,edit"
    When the client sends the prompt "clean up"
    Then the harness's tool call "rm -rf build" was refused
    And the client was not asked to approve a tool call

  @id=SCN-HARNESS-003 @status=implemented @conformance
  Scenario: A tool call inside the allowlist goes to the client for approval
    Given a harness scripted to run the tool "Edit notes.md" of kind "edit" when the prompt says "fix the typo"
    And the adapter runs that harness with the allowlist "read,edit"
    When the client sends the prompt "fix the typo" and approves every tool call
    Then the client was asked to approve "Edit notes.md"
    And the harness's tool call "Edit notes.md" was allowed

  @id=SCN-HARNESS-004 @status=implemented @conformance @realizes=SCN-FACTORY-ORCH-006
  Scenario: A steering message reaches a running session
    Given a harness scripted to keep its turn for "add a date" running until it receives "use the existing date helper"
    And the adapter runs that harness
    When the client sends the prompt "add a date" and, while the turn runs, sends "use the existing date helper"
    Then the harness received the prompts "add a date" and "use the existing date helper"
    And the turn of "add a date" ends with "end_turn"

  @id=SCN-HARNESS-005 @status=implemented @conformance
  Scenario: Cancel stops a running turn within 5 seconds
    Given a harness scripted to keep its turn for "add a date" running until it receives "never"
    And the adapter runs that harness
    When the client sends the prompt "add a date" and cancels the session while the turn runs
    Then the turn ends with "cancelled" within 5 seconds

  @id=SCN-HARNESS-006 @status=deprecated @conformance
  Scenario: Cancel stops a harness that ignores it within 5 seconds
    Given a harness scripted to keep its turn for "add a date" running and to ignore cancel
    And the adapter runs that harness
    When the client sends the prompt "add a date" and cancels the session while the turn runs
    Then the turn ends with "cancelled" within 5 seconds
    And the adapter exits with code 0

  @id=SCN-HARNESS-007 @status=deprecated @conformance @realizes=SCN-FACTORY-ORCH-007
  Scenario: The transcript export is a run record that links the session's transcript
    Given the adapter ran a session with the prompt "fix the typo" and the resource attributes "osf.run.id=run-1,osf.work_item.id=wi-1,osf.factory.version=3f2a9c1,osf.requester.kind=person,osf.requester.id=slack:U024BE7LH,osf.source=slack"
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" is a valid "run-record" with "osf.run.id" "run-1", "osf.harness.name" "acp" and "osf.outcome" "succeeded"
    And its "gen_ai.conversation.id" is the session's ID
    And its "osf.transcript.uri" is the file "$OUTPUT/transcript.jsonl", which holds the prompt "fix the typo"

  @id=SCN-HARNESS-008 @status=implemented @conformance
  Scenario: The run record of a cancelled session has the outcome "cancelled"
    Given the adapter ran a session whose turn was cancelled
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" has "osf.outcome" "cancelled"

  @id=SCN-HARNESS-009 @status=deprecated @conformance
  Scenario: The run record of a session the harness refused has the outcome "failed"
    Given the adapter ran a session whose turn the harness ended with "refusal"
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" has "osf.outcome" "failed"

  @id=SCN-HARNESS-010 @status=implemented @conformance @realizes=SCN-FACTORY-ORCH-002
  Scenario: A tool call refused by the allowlist is in the transcript
    Given the adapter with the allowlist "read,edit" refused the tool "rm -rf build" of kind "execute" in a session
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/transcript.jsonl" has the permission decision "refused by the allowlist" for "rm -rf build"

  @id=SCN-HARNESS-011 @status=implemented @conformance
  Scenario: A tool call the client refuses is in the transcript
    Given the adapter ran a session in which the client refused the tool "Edit notes.md" of kind "edit"
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/transcript.jsonl" has the permission decision "refused" for "Edit notes.md"

  @id=SCN-HARNESS-012 @status=implemented @conformance
  Scenario: A tool call the client approves is in the transcript
    Given the adapter ran a session in which the client approved the tool "Edit notes.md" of kind "edit"
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/transcript.jsonl" has the permission decision "allowed" for "Edit notes.md"

  @id=SCN-HARNESS-013 @status=implemented @conformance
  Scenario: A session whose turn was cancelled takes the next prompt
    Given a harness scripted to keep its turn for "add a date" running until it receives "never", and to reply "done" to "fix the typo"
    And the adapter runs that harness
    When the client cancels the turn of "add a date", waits 4 seconds and sends the prompt "fix the typo"
    Then the turn ends with "end_turn" and the reply "done"

  @id=SCN-HARNESS-014 @status=implemented @conformance @replaces=SCN-HARNESS-007 @realizes=SCN-FACTORY-ORCH-007
  Scenario: The transcript export is a run record of the session that links its transcript
    Given the adapter ran a session with the prompt "fix the typo" and the resource attributes "osf.run.id=run-1,osf.work_item.id=wi-1,osf.factory.version=3f2a9c1,osf.requester.kind=person,osf.requester.id=slack:U024BE7LH,osf.source=slack"
    When the developer runs "transcript" with the session's ID
    Then "$OUTPUT/run-record.json" is a valid "run-record" with "osf.run.id" "run-1" and "osf.outcome" "succeeded"
    And its "gen_ai.conversation.id" is the session's ID
    And its "osf.transcript.uri" is the file "$OUTPUT/transcript.jsonl", which holds the prompt "fix the typo"
