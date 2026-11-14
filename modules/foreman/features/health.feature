@module=foreman @owner=maintainers
Feature: Health
  "/v1/health" says whether the server reaches the systems it needs, without a token (ADR 0086).

  @id=SCN-FORE-075 @status=implemented
  Scenario: A server that reaches Temporal and NATS is healthy, without a token
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    When a program reads "/v1/health" without a token
    Then the answer is 200 with the status "ok" and the checks "temporal" and "nats" ok
    And "/v1/runs" without a token still answers 401

  @id=SCN-FORE-162 @status=implemented
  Scenario: The foreman shows a doctor's ping that its consumer received
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server
    When the console publishes "doctor.ping@v1" with the ID "ping_6b86b273ff34fce19d6b" on "osf.doctor.ping.v1"
    Then within 5 seconds "/v1/doctor/pings/ping_6b86b273ff34fce19d6b" with the token answers 200 with the ID and the time it was received
    And "/v1/doctor/pings/ping_0000000000000000000a" answers 404
