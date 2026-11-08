@module=intake @owner=maintainers
Feature: Health
  "/v1/health" says whether the server reaches the systems it needs, without a token (ADR 0086).

  @id=SCN-INTAKE-044 @status=implemented
  Scenario: A server that reaches its database and NATS is healthy
    Given the server runs with "INTAKE_DATABASE_URL" set to a PostgreSQL database and "INTAKE_NATS_URL" set to a NATS server
    When a program reads "/v1/health" without a token
    Then the answer is 200 with the status "ok" and the checks "database" and "nats" ok

  @id=SCN-INTAKE-045 @status=implemented
  Scenario: A server that does not reach NATS is failing and says what to fix
    Given the server runs with "INTAKE_NATS_URL" set to a port where no NATS listens
    When a program reads "/v1/health" without a token
    Then the answer is 503 with the status "failing", the check "database" ok and the check "nats" failing with a detail that names "INTAKE_NATS_URL"
