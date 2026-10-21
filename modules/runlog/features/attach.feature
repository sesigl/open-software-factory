@module=runlog @owner=maintainers
Feature: Attach a session to the trace of its launch
  "runlog attach" is the launcher's command for when a stage ends. The launcher started the harness with a W3C
  TRACEPARENT; attach exports the session file like "runlog export", but in that trace and below that span, and
  records how the stage ended in "osf.outcome".

  @id=SCN-RUN-027 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: attach puts the run into the trace of the launch
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the launcher runs "runlog attach session.jsonl" with TRACEPARENT "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
    Then the command exits with code 0
    And every span in "runs.jsonl" has the trace ID "4bf92f3577b34da6a3ce929d0e0e4736"
    And the root span "invoke_agent" has the parent span ID "00f067aa0ba902b7"

  @id=SCN-RUN-028 @status=implemented
  Scenario: attach records the outcome of the stage
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the launcher runs "runlog attach session.jsonl --outcome failed" with TRACEPARENT "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
    Then the command exits with code 0
    And the root span in "runs.jsonl" has "osf.outcome" "failed"

  @id=SCN-RUN-029 @status=implemented
  Scenario: attach without a TRACEPARENT is refused
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the launcher runs "runlog attach session.jsonl" with TRACEPARENT "not-a-trace"
    Then the command exits with code 1
    And the output contains "runlog attach needs a W3C TRACEPARENT from the launcher"
    And the output folder has no "runs.jsonl"

  @id=SCN-RUN-030 @status=implemented
  Scenario: An outcome the run-record contract does not know is refused
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the launcher runs "runlog attach session.jsonl --outcome done" with TRACEPARENT "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
    Then the command exits with code 1
    And the output contains "the run does not match the run-record contract: /span/osf.outcome"
    And the output folder has no "runs.jsonl"

  @id=SCN-RUN-076 @status=implemented
  Scenario: attach refuses a TRACEPARENT whose trace ID is only zeros
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the launcher runs "runlog attach session.jsonl" with TRACEPARENT "00-00000000000000000000000000000000-00f067aa0ba902b7-01"
    Then the command exits with code 1
    And the output contains "runlog attach needs a W3C TRACEPARENT from the launcher"

  @id=SCN-RUN-077 @status=implemented
  Scenario: attach refuses a TRACEPARENT whose parent span ID is only zeros
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the launcher runs "runlog attach session.jsonl" with TRACEPARENT "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01"
    Then the command exits with code 1
    And the output contains "runlog attach needs a W3C TRACEPARENT from the launcher"

  @id=SCN-RUN-078 @status=implemented
  Scenario: attach accepts trace and span IDs that start or end with zeros
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    When the launcher runs "runlog attach session.jsonl" with TRACEPARENT "00-0af7651916cd43dd8448eb211c803190-b7ad6b7169203330-01"
    Then the command exits with code 0
    And every span in "runs.jsonl" has the trace ID "0af7651916cd43dd8448eb211c803190"
    And the root span "invoke_agent" has the parent span ID "b7ad6b7169203330"
