@module=harness-proxy @owner=maintainers
Feature: The ACP proxy of a harness adapter
  serveProxy runs between an ACP client and the ACP agent of a harness: it passes sessions, prompts and updates on,
  answers tool calls outside the allowlist itself, stops an agent that does not end a cancelled turn, and records
  every session. exportTranscript turns a recorded session into a run record. runAdapter is the command line that
  every adapter shares (ADR 0050, ADR 0052).

  @id=SCN-HPROXY-001 @status=implemented
  Scenario: serveProxy passes a prompt to the agent and its reply back to the client
    Given a harness scripted to write "fixed" to "notes.md" and reply "done" when the prompt says "fix the typo"
    And serveProxy runs that harness for the client
    When the client starts a session in "$INPUT/app" and sends the prompt "fix the typo"
    Then the turn ends with "end_turn" and the reply "done"
    And "$INPUT/app/notes.md" says "fixed"

  @id=SCN-HPROXY-002 @status=implemented
  Scenario: The allowlist refuses a tool call of another kind without asking the client
    Given a harness scripted to run the tool "rm -rf build" of kind "execute" when the prompt says "clean up"
    And serveProxy runs that harness with the allowlist "read,edit"
    When the client sends the prompt "clean up"
    Then the harness's tool call "rm -rf build" was refused
    And the client was not asked to approve a tool call

  @id=SCN-HPROXY-003 @status=implemented
  Scenario: Without an allowlist the client decides every tool call
    Given a harness scripted to run the tool "rm -rf build" of kind "execute" when the prompt says "clean up"
    And serveProxy runs that harness without an allowlist
    When the client sends the prompt "clean up" and approves every tool call
    Then the client was asked to approve "rm -rf build"
    And the harness's tool call "rm -rf build" was allowed

  @id=SCN-HPROXY-004 @status=implemented
  Scenario: The hook of the adapter changes the session before the agent sees it
    Given a harness scripted to write "fixed" to "notes.md" when the prompt says "fix the typo"
    And serveProxy runs that harness with a hook that moves every session into the subfolder "sub"
    When the client starts a session in "$INPUT/app" and sends the prompt "fix the typo"
    Then "$INPUT/app/sub/notes.md" says "fixed"

  @id=SCN-HPROXY-005 @status=implemented
  Scenario: An agent that ignores a cancel is stopped within 5 seconds
    Given a harness scripted to keep its turn for "add a date" running and to ignore cancel
    And serveProxy runs that harness for the client
    When the client sends the prompt "add a date" and cancels the session while the turn runs
    Then the turn ends with "cancelled" within 5 seconds
    And serveProxy ends

  @id=SCN-HPROXY-006 @status=implemented
  Scenario: A cancel the agent honors ends the turn at once
    Given a harness scripted to keep its turn for "add a date" running until it receives "never"
    And serveProxy runs that harness for the client
    When the client sends the prompt "add a date" and cancels the session while the turn runs
    Then the turn ends with "cancelled" within 1 second

  @id=SCN-HPROXY-007 @status=implemented
  Scenario: exportTranscript writes the run record of a session with the harness name the adapter gives
    Given serveProxy for the harness "demo" ran a session with the prompt "fix the typo" and the resource attributes "osf.run.id=run-1,osf.work_item.id=wi-1,osf.factory.version=3f2a9c1,osf.requester.kind=person,osf.requester.id=slack:U024BE7LH,osf.source=slack"
    When the adapter exports the transcript of the session into "$OUTPUT"
    Then "$OUTPUT/run-record.json" is a valid "run-record" with "service.name" "harness-demo", "osf.harness.name" "demo", "osf.harness.version" "0.0.0" and "osf.outcome" "succeeded"
    And its "osf.transcript.uri" is the file "$OUTPUT/transcript.jsonl", which holds the prompt "fix the typo"

  @id=SCN-HPROXY-008 @status=implemented
  Scenario: The run record of a cancelled session has the outcome "cancelled"
    Given serveProxy ran a session whose turn was cancelled
    When the adapter exports the transcript of the session into "$OUTPUT"
    Then "$OUTPUT/run-record.json" has "osf.outcome" "cancelled"

  @id=SCN-HPROXY-009 @status=implemented
  Scenario: The run record of a session the harness refused has the outcome "failed"
    Given serveProxy ran a session whose turn the harness ended with "refusal"
    When the adapter exports the transcript of the session into "$OUTPUT"
    Then "$OUTPUT/run-record.json" has "osf.outcome" "failed"

  @id=SCN-HPROXY-010 @status=implemented
  Scenario: The run record sums the tokens of the turns and takes the session's last cost
    Given serveProxy ran a session with two turns of 1000 input and 200 output tokens each, after which the harness reported a cost of 0.25 USD and then 0.5 USD
    When the adapter exports the transcript of the session into "$OUTPUT"
    Then "$OUTPUT/run-record.json" has "gen_ai.usage.input_tokens" 2000, "gen_ai.usage.output_tokens" 400 and "osf.cost.usd" 0.5

  @id=SCN-HPROXY-011 @status=implemented
  Scenario: The transcript has the decisions of the client and of the allowlist
    Given serveProxy with the allowlist "read,edit" ran a session in which the client approved "Edit notes.md" of kind "edit" and the allowlist refused "rm -rf build" of kind "execute"
    When the adapter exports the transcript of the session into "$OUTPUT"
    Then "$OUTPUT/transcript.jsonl" has the permission decisions "allowed" for "Edit notes.md" and "refused by the allowlist" for "rm -rf build"

  @id=SCN-HPROXY-012 @status=implemented
  Scenario: The transcript has a tool call the client refused
    Given serveProxy ran a session in which the client refused "Edit notes.md" of kind "edit"
    When the adapter exports the transcript of the session into "$OUTPUT"
    Then "$OUTPUT/transcript.jsonl" has the permission decision "refused" for "Edit notes.md"

  @id=SCN-HPROXY-013 @status=implemented
  Scenario: The run record of a session that is still in a turn has the outcome "failed"
    Given serveProxy runs a session whose turn for "add a date" is still running
    When the adapter exports the transcript of the session into "$OUTPUT"
    Then "$OUTPUT/run-record.json" has "osf.outcome" "failed"

  @id=SCN-HPROXY-014 @status=implemented
  Scenario: runAdapter's "run" starts the agent the adapter names, with the allowlist of "--allow"
    Given a harness scripted to run the tool "rm -rf build" of kind "execute" when the prompt says "clean up"
    And runAdapter runs "run --allow read,edit" for an adapter whose agent is the harness named after "--"
    When the client sends the prompt "clean up"
    Then the harness's tool call "rm -rf build" was refused
    And the client was not asked to approve a tool call

  @id=SCN-HPROXY-015 @status=implemented
  Scenario: runAdapter's "transcript" writes the session's run record to OUTPUT with the adapter's harness name
    Given runAdapter "run" for the adapter "demo" with OSF_DATA "$OUTPUT/data" ran a session with the prompt "fix the typo"
    When runAdapter runs "transcript" with the session's ID, OSF_DATA "$OUTPUT/data" and OUTPUT "$OUTPUT/out"
    Then it gives 0 and prints "wrote $OUTPUT/out/run-record.json" and "wrote $OUTPUT/out/transcript.jsonl"
    And "$OUTPUT/out/run-record.json" has "service.name" "harness-demo" and "osf.harness.name" "demo"

  @id=SCN-HPROXY-016 @status=implemented
  Scenario: runAdapter's "transcript" without a session ID is a usage error
    When runAdapter runs "transcript" for the adapter "demo"
    Then it gives 2 and writes "harness-demo: name the session ID" to standard error

  @id=SCN-HPROXY-017 @status=implemented
  Scenario: runAdapter prints the adapter's usage for "--help"
    When runAdapter runs "--help" for an adapter with the usage "Usage: demo"
    Then it gives 0 and prints "Usage: demo"

  @id=SCN-HPROXY-018 @status=implemented
  Scenario: A prompt sent while a turn runs reaches the agent as the steering request the adapter names
    Given a harness scripted to keep its turn for "add a date" running until it receives "use the existing date helper"
    And serveProxy runs that harness with the steering request "_session/steering"
    When the client sends the prompt "add a date" and, while the turn runs, sends "use the existing date helper"
    And the client sends the prompt "add a test" after the turn ended
    Then the harness received "use the existing date helper" as the request "_session/steering"
    And both prompts end with "end_turn"
    And "add a test" reached the harness as a new turn that ends with "end_turn"
