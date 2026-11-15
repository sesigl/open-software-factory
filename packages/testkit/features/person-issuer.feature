@module=testkit @owner=maintainers
Feature: An issuer of person proofs
  fakes.personIssuer is an issuer of person proofs in the test process (ADR 0151). It publishes the key set of an
  Ed25519 key made for the test run and signs proofs on the testkit's clock, so a module's system test proves that it
  accepts a proof and refuses a changed one, without the console.

  @id=SCN-TK-182 @status=implemented
  Scenario: fakes.personIssuer signs a proof on the testkit's clock that the key set it serves verifies
    Given a module whose CLI fetches the key set at "DEMO_KEYS", verifies the proof in "DEMO_PROOF" with its key, and prints the header and the claims
    And its system test has fakes.personIssuer sign a proof of "ada@acme.dev" named "Ada" for "POST /v1/runs/run_1/signals" of "foreman" with a body, and expects a valid signature of the key's "kid", the type "osf-person+jwt", the issuer "console", the role "member", 2026-01-01T00:00:00Z and 30 seconds, and the body's SHA-256
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-183 @status=implemented
  Scenario: fakes.personIssuer with a name signs a proof whose claims and header the test changed
    Given a module whose CLI fetches the key set at "DEMO_KEYS", verifies the proof in "DEMO_PROOF" with its key, and prints the header and the claims
    And its system test starts fakes.personIssuer named "acme-portal", expects the setting "acme-portal=<url>", and has it sign a proof without "exp", with the role "admin", the type "JWT" and the algorithm "EdDSA"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-184 @status=implemented
  Scenario: fakes.personProof reads a proof that a module sent, with whether a key set verifies it and its body matches
    Given a library module whose system test has fakes.personIssuer sign a proof of "ada@acme.dev" for a body
    And the test reads it with fakes.personProof at the issuer's key set with that body, at another issuer's key set, and with another body
    And it expects the claims and the header, and a verified proof with a matching body only for the first
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
