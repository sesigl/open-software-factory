@module=person-proof @owner=maintainers
Feature: A person proven to a module
  personSigner signs a person proof for one call of a module in a person's name and gives the key set to publish;
  personChecker checks a request's proof against the key sets of the issuers a module's setting names, and gives the
  actor to record or the status and the reason to answer (ADR 0151).

  @id=SCN-PPROOF-001 @status=implemented
  Scenario: A proof that a signer makes for a person is accepted with that person by the module it is for
    Given a signer of one signing key on the clock 2026-01-01T00:00:00Z, its key set served at a URL
    When it signs a proof of "ada@acme.dev" named "Ada" with the role "member" for "POST /v1/runs/run_1/signals" of "foreman" with a body
    And a checker of "foreman" with the setting "console=<url>" checks it 5 seconds later in the header "OSF-Person" of that request, with the query "?view=1", for the person "ada@acme.dev"
    Then the check gives the actor of kind "person" "ada@acme.dev" named "Ada"
    And the proof's claims: the issuer "console", the person, the role, the audience, 2026-01-01T00:00:00Z, its end 30 seconds later, the method, the path and the SHA-256 of the body
    And the proof's header names the algorithm "Ed25519", the type "osf-person+jwt" and the "kid" of the key set's key

  @id=SCN-PPROOF-002 @status=implemented
  Scenario: A signer publishes every key of its setting with its thumbprint, signs with the first, and a proof of either key is accepted
    Given the signing setting "<the seed of RFC 8032's first test>,<a second seed>"
    When a program makes a signer of it and one of the two seeds the other way round, named "acme-portal"
    Then the key set of the first holds the public key of RFC 8032's first test with its thumbprint as "kid", then the second key, each with "kty" "OKP", "crv" "Ed25519", "alg" "Ed25519" and "use" "sig" and nothing else
    And a proof of the second signer for "grace@acme.dev" without a name is accepted by a checker of the key set of the first, and gives the actor without a name

  @id=SCN-PPROOF-003 @status=implemented
  Scenario: A signing setting that is no list of 64 hex digits is a SettingError that names the key's place, never the key
    When a program makes signers of "", "abc", "<a seed>,<64 times z>", "<a seed>,", "<a seed>0" and "0<a seed>"
    Then each is a SettingError "a signing key is 64 hex digits, the seed of an Ed25519 key: key <n> of <count> is not"
    And no message holds the seed

  @id=SCN-PPROOF-004 @status=implemented
  Scenario: A checker setting that is no list of name=url pairs of HTTP is a SettingError that names the pair
    When a program makes checkers of "", "console", "Console=http://console/keys", "con_sole=http://console/keys", "console=ftp://console/keys", "console=xhttp://console/keys" and "console=http://console/keys,=http://other/keys"
    And a program makes a checker of "console=https://console/keys, acme-portal=http://portal/keys"
    Then each of the first is a SettingError "a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "<pair>" is not"
    And the last gives a checker

  @id=SCN-PPROOF-005 @status=implemented
  Scenario: A call for a made-up person without a proof is refused, a trigger passes, and a call that always needs a proof is refused
    Given a checker of "foreman" with the setting of an issuer
    When it checks a request without "OSF-Person" for the person "varun@acme.dev", one for the trigger "tool:acme-portal", and one for that trigger that always needs a proof
    Then the person's is refused with 401 "send OSF-Person: the console's proof of the person (ADR 0151)" and the claimed "varun@acme.dev"
    And the trigger's gives the trigger as it was named
    And the one that always needs a proof is refused with 401 and the same reason

  @id=SCN-PPROOF-006 @status=implemented
  Scenario: A proof is accepted up to 10 seconds after its end and refused after that with its end
    Given a proof of "ada@acme.dev" for "foreman" signed at 2026-01-01T00:00:00Z that ends 30 seconds later
    When a checker of "foreman" checks it at 00:00:39 and at 00:00:41
    Then the first gives the person
    And the second is refused with 401 "the person proof ended at 2026-01-01T00:00:30Z"

  @id=SCN-PPROOF-007 @status=implemented
  Scenario: A proof signed up to 10 seconds ahead of the module's clock is accepted, one signed later is refused
    Given proofs of "ada@acme.dev" for "foreman" signed at 2026-01-01T00:00:10Z and at 2026-01-01T00:00:11Z
    When a checker of "foreman" checks each at 2026-01-01T00:00:00Z
    Then the first gives the person
    And the second is refused with 401 "the person proof was signed at 2026-01-01T00:00:11Z, after 2026-01-01T00:00:00.000Z"

  @id=SCN-PPROOF-008 @status=implemented
  Scenario: A proof that lives 60 seconds is accepted, one that lives 61 seconds is refused
    Given proofs of "ada@acme.dev" for "foreman" signed at 2026-01-01T00:00:00Z that end 60 and 61 seconds later
    When a checker of "foreman" checks each at that time
    Then the first gives the person
    And the second is refused with 401 "the person proof lives 61 seconds, longer than 60"

  @id=SCN-PPROOF-009 @status=implemented
  Scenario: A proof for another module is refused with its audience, one not valid yet with the reason of jose
    Given a proof of "ada@acme.dev" for "intake", and one for "foreman" that is not valid before a minute later
    When a checker of "foreman" checks both
    Then the first is refused with 401 "the person proof is for "intake", not "foreman""
    And the second is refused with 401 "the person proof does not verify: " and the reason of jose

  @id=SCN-PPROOF-010 @status=implemented
  Scenario: A proof of an issuer the setting does not name is refused, one of a team's tool that it names is accepted
    Given a checker of "foreman" with the setting "console=<url>, acme-portal=<url of the tool's key set>"
    When it checks a proof of the issuer "other" and a proof that the tool "acme-portal" signed with its own key
    Then the first is refused with 401 "the person proof's issuer "other" is not one of "console", "acme-portal""
    And the tool's gives the person

  @id=SCN-PPROOF-011 @status=implemented
  Scenario: A proof signed with a key outside its issuer's key set is refused with the key, and one with another key's "kid" with its signature
    Given a checker of "foreman" with the setting "console=<url>" of one issuer
    When it checks a proof that another issuer named "console" signed, once with its own "kid" and once with the "kid" of the first issuer's key
    Then the first is refused with 401 "the person proof's key "<kid>" is not in the key set of the issuer "console""
    And the second is refused with 401 "the person proof's signature does not verify with the key set of the issuer "console""

  @id=SCN-PPROOF-012 @status=implemented
  Scenario: A proof with another type or algorithm, or one without a signature, is refused with what it names
    Given a checker of "foreman" with the setting of an issuer
    When it checks a proof of the type "JWT", a proof of the algorithm "EdDSA" and a proof of the algorithm "none" without a signature
    Then the first is refused with 401 "the person proof's typ is "JWT", not "osf-person+jwt""
    And the second is refused with 401 "the person proof's alg is "EdDSA", not "Ed25519""
    And the third is refused with 401 "the person proof's alg is "none", not "Ed25519""

  @id=SCN-PPROOF-013 @status=implemented
  Scenario: A header that is no JSON Web Token is refused with the claimed person
    Given a checker of "foreman" with the setting of an issuer
    When it checks the header "OSF-Person: not-a-token" for the person "varun@acme.dev"
    Then it is refused with 401 "the person proof is not a JSON Web Token" and the claimed "varun@acme.dev"

  @id=SCN-PPROOF-014 @status=implemented
  Scenario: A signed proof whose claims are not valid person-proof is refused with their paths
    Given a proof for "foreman" without "sub" and "bodyDigest" and with the role "owner"
    When a checker of "foreman" checks it for the person "ada@acme.dev"
    Then it is refused with 401 "the person proof's claims are not valid person-proof: " and each problem with its path, and the claimed "ada@acme.dev"

  @id=SCN-PPROOF-015 @status=implemented
  Scenario: A valid proof for another method, path, body or person is refused with 403 and the claim that differs
    Given a proof of "ada@acme.dev" for "POST /v1/runs/run_1/signals" of "foreman" with a body
    When a checker of "foreman" checks it in the header "osf-person" of "PUT" on that path, of "POST" on "/v1/runs/run_2/signals", of another body, and for the person "varun@acme.dev"
    Then each is refused with 403: the method "POST" is not "PUT", the path is not "/v1/runs/run_2/signals", the bodyDigest is not the body's, and the sub "ada@acme.dev" is not the actor "varun@acme.dev"
    And each names the claimed "ada@acme.dev"

  @id=SCN-PPROOF-016 @status=implemented
  Scenario: A key set that cannot be fetched or is no person-keys answers 503 and names its issuer
    Given a checker of "foreman" with the issuers "down" at a closed port, "broken" that answers 500, "private" whose key holds "d" and "text" that answers no JSON
    When it checks a valid proof of each issuer
    Then each is refused with 503 and a reason that names the issuer and its URL: "cannot fetch", "HTTP 500", "/keys/0/d" and "is not valid person-keys"
