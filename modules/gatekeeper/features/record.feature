@module=gatekeeper @owner=maintainers
Feature: Signed approval records
  A record says who decided what and when. A signed record shows that nobody changed it afterwards.

  @id=SCN-GATE-026 @status=implemented
  Scenario: A signed record verifies with the public key
    Given a record that "gatekeeper status" wrote with the key of "gatekeeper keys" in "GATEKEEPER_SIGNING_KEY"
    When the user runs "gatekeeper verify --public-key gatekeeper.pub record.json"
    Then the command exits with code 0
    And the output says "verified: approved by slack:U0ADA"

  @id=SCN-GATE-027 @status=implemented
  Scenario: A record whose approver was changed fails verification
    Given a record that "gatekeeper status" wrote with the key of "gatekeeper keys" in "GATEKEEPER_SIGNING_KEY"
    And its "decidedBy" changed to "slack:U0EVE"
    When the user runs "gatekeeper verify --public-key gatekeeper.pub record.json"
    Then the command exits with code 1
    And the error output says "the signature does not match"

  @id=SCN-GATE-028 @status=implemented
  Scenario: A record without a signature fails verification
    Given a record that "gatekeeper status" wrote without "GATEKEEPER_SIGNING_KEY"
    When the user runs "gatekeeper verify --public-key gatekeeper.pub record.json"
    Then the command exits with code 1
    And the error output says "the record has no signature"

  @id=SCN-GATE-037 @status=implemented
  Scenario: The command "keys" writes a key pair for signing records
    When the user runs "gatekeeper keys"
    Then the command exits with code 0
    And the output names the files "$OUTPUT/gatekeeper.pem" and "$OUTPUT/gatekeeper.pub"
    And "$OUTPUT/gatekeeper.pem" holds an Ed25519 private key and "$OUTPUT/gatekeeper.pub" its public key in PEM
