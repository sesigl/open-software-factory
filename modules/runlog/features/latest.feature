@module=runlog @owner=maintainers
Feature: Export the newest session and one file per run
  "runlog export --latest <folder>..." exports the session below the folders whose last event is the latest, in
  place of a named session file. "--per-run" writes the run to $OUTPUT/<run id>.jsonl and replaces that file, in
  place of appending to $OUTPUT/runs.jsonl. This repository's "make run-record" uses both (ADR 0027).

  @id=SCN-RUN-055 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: --latest exports the session whose last event is the latest
    Given a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2026-01-01T09:59:45Z"
    And the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69" that ended at "2026-01-01T10:00:13Z" in the folder "sessions"
    When the developer runs "runlog export --latest sessions"
    Then the command exits with code 0
    And "runs.jsonl" has 1 run with "gen_ai.conversation.id" "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"

  @id=SCN-RUN-056 @status=implemented
  Scenario: --latest without a session below the folders fails
    Given a Git repository with one commit and a folder "sessions" that holds only "notes.json", which is no session
    When the developer runs "runlog export --latest sessions"
    Then the command exits with code 1
    And the output contains "no Claude Code, Codex or OpenCode session below sessions"
    And the output folder has no "runs.jsonl"

  @id=SCN-RUN-057 @status=implemented
  Scenario: --per-run writes the run to a file named after its run ID
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl --per-run"
    Then the command exits with code 0
    And "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    And the output folder has no "runs.jsonl"

  @id=SCN-RUN-058 @status=implemented
  Scenario: A second --per-run export of the same session replaces its file
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    And the developer ran "runlog export session.jsonl --per-run"
    When the developer runs "runlog export session.jsonl --per-run" again
    Then "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"

  @id=SCN-RUN-059 @status=implemented
  Scenario: --per-run turns the characters of a run ID that a file name cannot hold into hyphens
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the developer runs "runlog export session.jsonl --per-run" with OTEL_RESOURCE_ATTRIBUTES "osf.run.id=team/run:7"
    Then the command exits with code 0
    And "team-run-7.jsonl" has 1 run with "osf.run.id" "team/run:7" on the resource
