@module=contracts @owner=maintainers
Feature: Reading run records
  A module that reads runs gets their spans from runSpans, with the OTLP/JSON attributes decoded, instead of
  decoding OTLP/JSON itself.

  @id=SCN-CTR-010 @status=implemented
  Scenario: runSpans gives each span of a run record with its resource and decoded attributes
    Given a run record whose resource has "osf.run.id" "run-1" and whose span "invoke_agent" has the integer "gen_ai.usage.input_tokens" "1200", the double "osf.cost.usd" 0.42 and the array "osf.pull_request.urls" with "https://github.com/acme/web/pull/7"
    When the module reads the spans of the run record
    Then it gets one span named "invoke_agent" that starts at 1767225600000000000 nanoseconds
    And the span's resource has "osf.run.id" "run-1"
    And the span has "gen_ai.usage.input_tokens" 1200, "osf.cost.usd" 0.42 and "osf.pull_request.urls" ["https://github.com/acme/web/pull/7"]

  @id=SCN-CTR-011 @status=implemented
  Scenario: runSpans gives no spans for a value that is not a trace export request
    Given the spend log row {"request_id": "r1", "spend": 0.1}
    When the module reads the spans of the value
    Then it gets no spans
