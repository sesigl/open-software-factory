@module=runlog @owner=maintainers
Feature: Export to an OTLP endpoint
  With OTEL_EXPORTER_OTLP_ENDPOINT set, "runlog export" sends the run as OTLP/HTTP JSON to <endpoint>/v1/traces
  instead of writing runs.jsonl. It retries while the endpoint answers 429, 502, 503 or 504.

  @id=SCN-RUN-016 @status=implemented @realizes=SCN-FACTORY-DATA-006
  Scenario: The run goes to the configured OTLP endpoint
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    And an OTLP endpoint that accepts traces
    When the developer runs "runlog export session.jsonl" with OTEL_EXPORTER_OTLP_ENDPOINT set to the endpoint
    Then the command exits with code 0
    And the endpoint received "POST /v1/traces" with the root span "invoke_agent" of the conversation "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    And the output folder has no "runs.jsonl"

  @id=SCN-RUN-017 @status=implemented
  Scenario: The export retries after an outage of the OTLP endpoint
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    And an OTLP endpoint that answers 503 once and then accepts traces
    When the developer runs "runlog export session.jsonl" with OTEL_EXPORTER_OTLP_ENDPOINT set to the endpoint
    Then the command exits with code 0
    And the endpoint received "POST /v1/traces" twice with the same run

  @id=SCN-RUN-018 @status=implemented
  Scenario: An export the OTLP endpoint refuses fails
    Given a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"
    And an OTLP endpoint that answers 400
    When the developer runs "runlog export session.jsonl" with OTEL_EXPORTER_OTLP_ENDPOINT set to the endpoint
    Then the command exits with code 1
    And the output contains "the OTLP endpoint refused the run"
