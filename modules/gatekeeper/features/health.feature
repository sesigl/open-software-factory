@module=gatekeeper @owner=maintainers
Feature: Health
  "/v1/health" says whether the server reaches the systems it needs, without a token (ADR 0086).

  @id=SCN-GATE-091 @status=implemented
  Scenario: A server that reaches its database, OPA and NATS is healthy
    Given the server runs the README's files with "GATEKEEPER_NATS_URL" set to a NATS server
    When a program reads "/v1/health" without a token
    Then the answer is 200 with the status "ok" and the checks "database", "opa" and "nats" ok

  @id=SCN-GATE-092 @status=implemented
  Scenario: A server without OPA is failing and says what to fix
    Given the server runs the README's files with "GATEKEEPER_OPA" set to a program that does not exist
    When a program reads "/v1/health" without a token
    Then the answer is 503 with the status "failing" and the check "opa" failing with a detail that names "GATEKEEPER_OPA"
