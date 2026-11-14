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

  @id=SCN-FORE-081 @status=implemented
  Scenario: A run's view names its trace ID
    Given "foreman serve" runs the README's "factory.yaml" with "OTEL_EXPORTER_OTLP_ENDPOINT" set to an OTLP receiver
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    And the run completes
    Then "/v1/runs/<id>" shows the "traceId" of the spans the receiver got

  @id=SCN-FORE-155 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: Each stage's span carries its session's tokens and cost, and the run's view names the span
    Given "foreman serve" runs the README's "factory.yaml" with "OTEL_EXPORTER_OTLP_ENDPOINT" set to an OTLP receiver, and a harness whose turns report 900 input tokens, 30 output tokens and 0.25 USD
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    And the run completes
    Then the spans "stage plan" and "stage implement" carry "gen_ai.usage.input_tokens" 900, "gen_ai.usage.output_tokens" 30 and "osf.cost.usd" 0.25 from the run record of their session
    And "/v1/runs/<id>" names the "spanId" of each stage's span

  @id=SCN-FORE-163 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: A sandboxed stage's span carries the tokens and cost of the session in its sandbox
    Given "foreman serve" runs the README's "sandboxed/factory.yaml" with a fake sandbox adapter as "docker", "OTEL_EXPORTER_OTLP_ENDPOINT" set to an OTLP receiver, and a harness whose turns report 900 input tokens, 30 output tokens and 0.25 USD
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    And the run completes
    Then the spans "stage plan" and "stage implement" carry "gen_ai.usage.input_tokens" 900, "gen_ai.usage.output_tokens" 30 and "osf.cost.usd" 0.25 from the run record that the harness wrote in the sandbox
