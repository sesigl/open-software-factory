@module=proof @owner=maintainers
Feature: Verify a bundle
  "proof verify <bundle>" checks the manifest against the evidence-bundle contract, every artifact against its
  checksum, and that each listed scenario passed with evidence. It exits 1 on any problem.

  @id=SCN-PROOF-018 @status=implemented
  Scenario: A bundle whose listed scenarios passed is verified
    Given a bundle where "SCN-WEB-001" passed with a screenshot
    When the developer runs "proof verify evidence --scenario SCN-WEB-001"
    Then the command exits with code 0
    And the output contains "SCN-WEB-001 passed with 1 artifact"

  @id=SCN-PROOF-019 @status=implemented
  Scenario: A listed scenario without evidence fails the verification
    Given a bundle where "SCN-WEB-001" passed with a screenshot
    When the developer runs "proof verify evidence --scenario SCN-WEB-001 --scenario SCN-WEB-009"
    Then the command exits with code 1
    And the output contains "SCN-WEB-009 has no evidence"

  @id=SCN-PROOF-020 @status=implemented
  Scenario: A failed scenario fails the verification
    Given a bundle where "SCN-WEB-001" passed and "SCN-WEB-002" failed
    When the developer runs "proof verify evidence"
    Then the command exits with code 1
    And the output contains "SCN-WEB-002 failed"

  @id=SCN-PROOF-021 @status=implemented
  Scenario: An artifact changed after bundling fails the verification
    Given a bundle where "SCN-WEB-001" passed with a screenshot
    And the screenshot was changed after the bundle was written
    When the developer runs "proof verify evidence"
    Then the command exits with code 1
    And the output contains "artifacts/SCN-WEB-001/checkout.png does not match its SHA-256"

  @id=SCN-PROOF-022 @status=implemented
  Scenario: A manifest that breaks the contract fails the verification
    Given a bundle whose manifest has the scenario ID "WEB-1"
    When the developer runs "proof verify evidence"
    Then the command exits with code 1
    And the output contains "evidence.json /scenarios/0/id"
