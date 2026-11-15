@module=gatekeeper @owner=maintainers
Feature: Check the proof of the person who decides
  With GATEKEEPER_PERSON_KEYS, "gatekeeper serve" checks each decision through the API: the header OSF-Person must
  hold a person proof that an issuer of the setting signed for gatekeeper, this request and the person in "by"
  (ADR 0151). gatekeeper records the proven person. Without the setting it works as before and says so once.

  @id=SCN-GATE-098 @status=implemented
  Scenario: A decision with the console's proof of the person is recorded with that person and the proof's name
    Given the server checks the console's person proofs and asked "maintainers", whose member is "ada@acme.dev", for approval of the README request
    When the console posts to "/v1/gates/<gate>/decisions" the decision "approved" by "ada@acme.dev" as indented JSON, with its proof for "ada@acme.dev" named "Ada"
    Then the answer shows the state "approved" and a record approved by the person "ada@acme.dev" with the name "Ada"
    And "/v1/gates/<gate>" shows the same record

  @id=SCN-GATE-099 @status=implemented
  Scenario: A decision with the API token but without a proof is refused, for a made-up person and for a trigger, after the body is checked
    Given the server checks the console's person proofs and asked "maintainers", whose member is "ada@acme.dev", for approval of the README request
    When a program posts with the API token and without "OSF-Person" the decision "approved" by the person "ada@acme.dev", the decision "approved" by the trigger "tool:acme-portal" and the decision "maybe" by "ada@acme.dev"
    Then the answers have the statuses 401, 401 and 400
    And the first two problems have the title "The person is not proven" and say "send OSF-Person: the console's proof of the person (ADR 0151)"
    And "/v1/gates/<gate>" still shows the state "pending"

  @id=SCN-GATE-100 @status=implemented
  Scenario: A proof past its end is refused, and the log names the person and the reason but not the proof
    Given the server checks the console's person proofs and asked "maintainers", whose member is "ada@acme.dev", for approval of the README request
    When the console posts the decision "approved" by "ada@acme.dev" with a proof that ended at 2025-12-31T23:58:50Z
    Then the answer has the status 401 and a problem that says "the person proof ended at 2025-12-31T23:58:50Z"
    And the server's error output says 'gatekeeper: refused POST /v1/gates/<gate>/decisions for "ada@acme.dev": the person proof ended at 2025-12-31T23:58:50Z'
    And the server's error output does not hold the proof
    And "/v1/gates/<gate>" still shows the state "pending"

  @id=SCN-GATE-101 @status=implemented
  Scenario: A proof for another module, another path, another body or another person is refused and names the claim
    Given the server checks the console's person proofs and asked "maintainers", whose member is "ada@acme.dev", for approval of the README request
    When the console posts the decision "approved" by "ada@acme.dev" with a proof for "foreman", for the path "/v1/gates/g0000000000000000/decisions", for the decision "rejected" and for "grace@acme.dev"
    Then the answers have the statuses 401, 403, 403 and 403
    And their problems say 'the person proof is for "foreman", not "gatekeeper"', 'the person proof's path "/v1/gates/g0000000000000000/decisions" is not this request's "/v1/gates/<gate>/decisions"', "the person proof's bodyDigest is not this request's body" and 'the person proof's sub "grace@acme.dev" is not the actor "ada@acme.dev"'
    And "/v1/gates/<gate>" still shows the state "pending"

  @id=SCN-GATE-102 @status=implemented
  Scenario: A team's own tool named in the setting decides with its own proof, and an issuer that the setting does not name is refused
    Given the server checks the person proofs of "console" and of the team's tool "acme-portal" and asked "maintainers", whose member is "grace@acme.dev", for approval of the README request
    When the issuer "other-tool" posts the decision "approved" by "grace@acme.dev" with its proof, and then "acme-portal" does the same with its proof
    Then the first answer has the status 401 and a problem that says 'the person proof's issuer "other-tool" is not one of "console", "acme-portal"'
    And the second answer shows the state "approved" and a record approved by the person "grace@acme.dev"

  @id=SCN-GATE-103 @status=implemented
  Scenario: A server whose GATEKEEPER_PERSON_KEYS is no list of name=url pairs exits with code 2 and names the pair
    Given the README policy and groups
    When the user runs "gatekeeper serve" with "GATEKEEPER_PERSON_KEYS" set to "console"
    Then the command exits with code 2
    And its error output says 'gatekeeper: GATEKEEPER_PERSON_KEYS: a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "console" is not'

  @id=SCN-GATE-104 @status=implemented
  Scenario: Without GATEKEEPER_PERSON_KEYS a decision for a made-up person is accepted as before, and the server says so once
    Given the server runs without "GATEKEEPER_PERSON_KEYS" and asked "maintainers" for approval of the README request
    When a program posts with the API token and without "OSF-Person" the decision "approved" by the person "slack:U0ADA"
    Then the answer shows the state "approved" and a record approved by the person "slack:U0ADA"
    And the server's error output says once "gatekeeper: GATEKEEPER_PERSON_KEYS is not set, so a caller with GATEKEEPER_API_TOKEN decides a gate as any person it names (ADR 0151)"

  @id=SCN-GATE-105 @status=implemented
  Scenario: An issuer whose key set answers 500 gives the status 503 that names the issuer, and the gate stays pending
    Given the server checks the person proofs of "console", whose key set answers 500, and asked "maintainers" for approval of the README request
    When the console posts the decision "approved" by "ada@acme.dev" with its proof
    Then the answer has the status 503 and a problem with the title "The person cannot be checked" that says 'cannot fetch the key set of the issuer "console" at <url>: HTTP 500'
    And "/v1/gates/<gate>" still shows the state "pending"
