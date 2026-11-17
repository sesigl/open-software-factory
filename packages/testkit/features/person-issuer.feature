@module=testkit @owner=maintainers
Feature: An issuer of person proofs
  fakes.personIssuer is an issuer of person proofs in the test process (ADR 0151). It publishes the key set of an
  Ed25519 key made for the test run and signs proofs on the testkit's clock, so a module's system test proves that it
  accepts a proof and refuses a changed one, without the console.

  @id=SCN-TK-182 @status=implemented
  Scenario: fakes.personIssuer signs a proof on the testkit's clock that the key set it serves verifies
    Given a proof of "ada@acme.dev" named "Ada" for "POST /v1/runs/run_1/signals" of "foreman" with a body, signed by fakes.personIssuer
    When a module fetches the key set of the issuer and verifies the proof with its key
    Then the proof has a valid signature of the key's "kid", the type "osf-person+jwt", the issuer "console", the role "member", 2026-01-01T00:00:00Z and 30 seconds, and the body's SHA-256

  @id=SCN-TK-183 @status=implemented
  Scenario: fakes.personIssuer with a name signs a proof whose claims and header the test changed
    Given fakes.personIssuer named "acme-portal" with the setting "acme-portal=<url>", and a proof it signed without "exp", with the role "admin", the type "JWT" and the algorithm "EdDSA"
    When a module fetches the key set of the issuer and verifies the proof with its key
    Then the proof verifies with the issuer "acme-portal" and the changed claims and header

  @id=SCN-TK-184 @status=implemented
  Scenario: fakes.personProof reads a proof that a module sent, with whether a key set verifies it and its body matches
    Given a proof of "ada@acme.dev" for a body, signed by fakes.personIssuer, and another issuer
    When the test reads it with fakes.personProof at the issuer's key set with that body, at the other issuer's key set, and with another body
    Then it has the claims and the header, and a verified proof with a matching body only for the first
