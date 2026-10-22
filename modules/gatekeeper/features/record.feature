@module=gatekeeper @owner=maintainers
Feature: Signed approval records
  A record says who decided what and when. A signed record shows that nobody changed it afterwards.

  @id=SCN-GATE-026 @status=planned
  Scenario: A signed record verifies with the public key
    Given a record that "gatekeeper status" wrote with an Ed25519 key in "GATEKEEPER_SIGNING_KEY"
    When the user runs "gatekeeper verify --public-key key.pub record.json"
    Then the command exits with code 0
    And the output says "verified: approved by slack:U0ADA"

  @id=SCN-GATE-027 @status=planned
  Scenario: A record whose approver was changed fails verification
    Given a record that "gatekeeper status" wrote with an Ed25519 key in "GATEKEEPER_SIGNING_KEY"
    And its "decidedBy" changed to "slack:U0EVE"
    When the user runs "gatekeeper verify --public-key key.pub record.json"
    Then the command exits with code 1
    And the error output says "the signature does not match"

  @id=SCN-GATE-028 @status=planned
  Scenario: A record without a signature fails verification
    Given a record that "gatekeeper status" wrote without "GATEKEEPER_SIGNING_KEY"
    When the user runs "gatekeeper verify --public-key key.pub record.json"
    Then the command exits with code 1
    And the error output says "the record has no signature"
