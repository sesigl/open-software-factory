@module=foreman @owner=maintainers
Feature: Traces
  With "OTEL_EXPORTER_OTLP_ENDPOINT", every run is one OTLP trace: a span for the run and a span per stage, and each
  stage's harness gets the trace in "TRACEPARENT" (ADR 0087).

  @id=SCN-FORE-076 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: A run sends a span per stage and one for the run, in one trace
    Given "foreman serve" runs the README's "factory.yaml" with "OTEL_EXPORTER_OTLP_ENDPOINT" set to an OTLP receiver
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    And the run completes
    Then the receiver got the spans "stage plan", "stage implement" and "run hello", each with the run's "osf.run.id" and the same trace ID
    And the stage spans are children of the run's span, with the outcome "succeeded" and the agent of their stage

  @id=SCN-FORE-077 @status=implemented
  Scenario: Each stage's harness gets the trace and the stage's span in "TRACEPARENT"
    Given "foreman serve" runs the README's "factory.yaml" with "OTEL_EXPORTER_OTLP_ENDPOINT" set to an OTLP receiver
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    And the run completes
    Then the harness's session of each stage got a "TRACEPARENT" with the trace ID and the span ID of that stage's span
