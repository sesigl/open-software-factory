@module=console @owner=maintainers
Feature: The person proven to every module
  With "CONSOLE_SIGNING_KEY" the console signs a person proof for each call it makes in a person's name to foreman,
  intake and gatekeeper, in the header "OSF-Person", and publishes its keys at "/.well-known/jwks.json" (ADR 0151). A
  module that checks proofs then records the person the console signed in, not the one a body names.

  @id=SCN-CONSOLE-268 @status=implemented
  Scenario: An action of a signed-in person carries the person's proof, which the console's keys verify, to foreman, gatekeeper and intake
    Given a console that signs in with OpenID Connect, with "CONSOLE_SIGNING_KEY", a foreman with a run that waits at a gate, its gatekeeper and intake
    And the person "grace@acme.dev" named "Grace" with the role "factory-engineer" signed in
    When she sends the form "Cancel" of the run, the form "Approve" of its gate and the form "submit work"
    Then foreman, gatekeeper and intake each received a proof in "OSF-Person" that the console's key set at "/.well-known/jwks.json" verifies, of the SHA-256 of the body they received
    And each proof names the issuer "console", "grace@acme.dev", "Grace", "factory-engineer", its module as audience, 2026-01-01T00:00:00Z and 30 seconds later, "POST" and the request's path
    And its header names "Ed25519", "osf-person+jwt" and the "kid" of the console's first key

  @id=SCN-CONSOLE-269 @status=implemented
  Scenario: The console publishes every key of "CONSOLE_SIGNING_KEY" at "/.well-known/jwks.json" without a session, for every host
    Given a console that signs in with OpenID Connect at "localhost", with two keys in "CONSOLE_SIGNING_KEY"
    When a program asks for "/.well-known/jwks.json" at "127.0.0.1" without a session
    Then the answer is 200 with "cache-control: max-age=300" and a key set of two Ed25519 public keys, each with its "kid" and no private part

  @id=SCN-CONSOLE-270 @status=implemented
  Scenario: Behind a sign-in proxy without an access file the proof names the proxy's person as a member
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and "CONSOLE_SIGNING_KEY", no access file, and a foreman with a failed run
    When the person "ada@acme.dev" sends the form "Run again" of the run
    Then the foreman received a proof that the console's keys verify, of "ada@acme.dev" with the role "member" and no name, for "foreman" and "POST /v1/runs/run_5d41402abc4b2a76b971/retry"

  @id=SCN-CONSOLE-271 @status=implemented
  Scenario: Without "CONSOLE_SIGNING_KEY" an action carries no proof, the console publishes no keys and "/health" warns
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and without "CONSOLE_SIGNING_KEY", and a foreman with a running run
    When the person "ada@acme.dev" sends the form "Cancel" of the run, a program asks for "/.well-known/jwks.json" and a person opens "/health"
    Then the foreman received the signal without the header "OSF-Person"
    And "/.well-known/jwks.json" answers 404
    And "/health" has the row "person proof", "warning" and "set CONSOLE_SIGNING_KEY: without it the console sends no proof of the person, and foreman, intake and gatekeeper refuse its actions when they check proofs"

  @id=SCN-CONSOLE-272 @status=implemented
  Scenario: A malformed "CONSOLE_SIGNING_KEY" fails "console doctor" and stops "console serve", and neither names the key
    Given "CONSOLE_SIGNING_KEY" set to 63 hex digits
    When the user runs "console doctor" and "console serve"
    Then "console doctor" exits with code 1 and prints "FAIL  person proof: CONSOLE_SIGNING_KEY: a signing key is 64 hex digits, the seed of an Ed25519 key: key 1 of 1 is not: set it to 64 random hex digits, like "openssl rand -hex 32""
    And "console serve" exits with an error that says "CONSOLE_SIGNING_KEY: a signing key is 64 hex digits, the seed of an Ed25519 key: key 1 of 1 is not"
    And no output holds the key
