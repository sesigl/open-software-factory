@module=runlog @owner=maintainers
Feature: Watch session folders
  "runlog watch <folder>..." exports every session below the folders once it has ended: its last event is at least
  --idle minutes (default 5) before now. It remembers what it exported in its data folder, so each session is
  exported once. It repeats every --interval seconds until it has made --passes passes. In the system tests, now is
  2026-01-01T00:00:00Z.

  @id=SCN-RUN-031 @status=planned @realizes=SCN-FACTORY-DATA-001
  Scenario: watch exports a session that has ended
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"
    When the developer runs "runlog watch sessions --passes 1"
    Then the command exits with code 0
    And "runs.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"

  @id=SCN-RUN-032 @status=planned
  Scenario: watch leaves a session that is still running for a later pass
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:58:45Z"
    When the developer runs "runlog watch sessions --passes 1"
    Then the command exits with code 0
    And the output folder has no "runs.jsonl"

  @id=SCN-RUN-033 @status=planned
  Scenario: --idle sets how long a session must be quiet before watch exports it
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:58:45Z"
    When the developer runs "runlog watch sessions --passes 1 --idle 1"
    Then the command exits with code 0
    And "runs.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"

  @id=SCN-RUN-034 @status=planned
  Scenario: A second watch does not export a session again
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"
    And the developer ran "runlog watch sessions --passes 1"
    When the developer runs "runlog watch sessions --passes 1" again
    Then the command exits with code 0
    And "runs.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"

  @id=SCN-RUN-035 @status=planned
  Scenario: watch repeats its pass and exports each session once
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"
    When the developer runs "runlog watch sessions --passes 2 --interval 0"
    Then the command exits with code 0
    And "runs.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"

  @id=SCN-RUN-036 @status=planned
  Scenario: watch skips files that are no session
    Given a Git repository with one commit and a folder "sessions" with the file "notes.json" with the text "{}"
    When the developer runs "runlog watch sessions --passes 1"
    Then the command exits with code 0
    And the output folder has no "runs.jsonl"
