@module=cli @owner=maintainers
Feature: Health
  A server answers GET /v1/health with healthOf: one check per system it needs, each within 2 seconds (ADR 0086).

  @id=SCN-CLI-017 @status=implemented
  Scenario: A server whose probes all answer is ok
    Given the probes "database" and "nats" that both answer
    When the module asks for its health
    Then it gets the status "ok" with the checks "database" and "nats" ok and no detail

  @id=SCN-CLI-018 @status=implemented
  Scenario: A probe that fails makes the server failing and says what failed and how to fix it
    Given the probe "database" that fails with "connection refused" and the fix "check INTAKE_DATABASE_URL"
    When the module asks for its health
    Then it gets the status "failing" with the check "database" not ok and the detail "connection refused: check INTAKE_DATABASE_URL"

  @id=SCN-CLI-019 @status=implemented
  Scenario: A probe that does not answer within 2 seconds fails
    Given the probe "temporal" that never answers, with the fix "check FOREMAN_TEMPORAL_ADDRESS"
    When the module asks for its health
    Then it gets the status "failing" within 3 seconds and the detail "no answer within 2 s: check FOREMAN_TEMPORAL_ADDRESS"
