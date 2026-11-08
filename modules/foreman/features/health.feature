@module=foreman @owner=maintainers
Feature: Health
  "/v1/health" says whether the server reaches the systems it needs, without a token (ADR 0086).

  @id=SCN-FORE-075 @status=implemented
  Scenario: A server that reaches Temporal and NATS is healthy, without a token
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    When a program reads "/v1/health" without a token
    Then the answer is 200 with the status "ok" and the checks "temporal" and "nats" ok
    And "/v1/runs" without a token still answers 401
