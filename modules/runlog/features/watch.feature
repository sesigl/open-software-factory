@module=runlog @owner=maintainers
Feature: Watch session folders
  "runlog watch <folder>..." exports every session below the folders once it has ended: its last event is at least
  --idle minutes (default 5) before now. It remembers what it exported in its data folder, so each session is
  exported once. It repeats every --interval seconds until it has made --passes passes. In the system tests, now is
  2026-01-01T00:00:00Z.

  @id=SCN-RUN-031 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: watch exports a session that has ended
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"
    When the developer runs "runlog watch sessions --passes 1"
    Then the command exits with code 0
    And "runs.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"

  @id=SCN-RUN-032 @status=implemented
  Scenario: watch leaves a session that is still running for a later pass
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:58:45Z"
    When the developer runs "runlog watch sessions --passes 1"
    Then the command exits with code 0
    And the output folder has no "runs.jsonl"

  @id=SCN-RUN-033 @status=implemented
  Scenario: --idle sets how long a session must be quiet before watch exports it
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:58:45Z"
    When the developer runs "runlog watch sessions --passes 1 --idle 1"
    Then the command exits with code 0
    And "runs.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"

  @id=SCN-RUN-034 @status=implemented
  Scenario: A second watch does not export a session again
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"
    And the developer ran "runlog watch sessions --passes 1"
    When the developer runs "runlog watch sessions --passes 1" again
    Then the command exits with code 0
    And "runs.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"

  @id=SCN-RUN-035 @status=implemented
  Scenario: watch repeats its pass and exports each session once
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"
    When the developer runs "runlog watch sessions --passes 2 --interval 0"
    Then the command exits with code 0
    And "runs.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"

  @id=SCN-RUN-036 @status=implemented
  Scenario: watch skips files that are no session
    Given a Git repository with one commit and a folder "sessions" with the file "notes.json" with the text "{}"
    When the developer runs "runlog watch sessions --passes 1"
    Then the command exits with code 0
    And the output folder has no "runs.jsonl"

  @id=SCN-RUN-042 @status=implemented
  Scenario: watch names a session it could not export and exports it in a later pass
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"
    And an OTLP endpoint that answers 400 once and then accepts traces
    When the developer runs "runlog watch sessions --passes 2 --interval 0" with OTEL_EXPORTER_OTLP_ENDPOINT set to the endpoint
    Then the command exits with code 0
    And the output contains "session.jsonl: the OTLP endpoint refused the run"
    And the endpoint received "POST /v1/traces" twice

  @id=SCN-RUN-043 @status=implemented
  Scenario: watch skips the transcript of a Claude Code subagent
    Given a Git repository with one commit and a folder "sessions" with a Claude Code subagent transcript of the session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"
    When the developer runs "runlog watch sessions --passes 1"
    Then the command exits with code 0
    And the output folder has no "runs.jsonl"

  @id=SCN-RUN-081 @status=implemented
  Scenario: watch reads .jsonl and .json files and no others
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" as "claude/session.jsonl", the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy" as "opencode/session.json" and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69" as "codex/rollout.jsonl.bak"
    When the developer runs "runlog watch sessions --passes 1" at "2026-01-02T00:00:00Z"
    Then the command exits with code 0
    And "runs.jsonl" has 2 runs with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" and "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"

  @id=SCN-RUN-082 @status=implemented
  Scenario: watch names each run it exported
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"
    When the developer runs "runlog watch sessions --passes 1"
    Then the output is the one line "exported the run of 5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d to <output folder>/runs.jsonl"
