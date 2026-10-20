@module=spec-trace @owner=maintainers
Feature: next-id
  spec-trace next-id prints the next free scenario ID of a prefix. IDs are never reused.

  @id=SCN-TRACE-046 @status=implemented
  Scenario: next-id follows the highest ID of the prefix, deprecated included
    Given a repository with the scenarios "SCN-SHOP-001", the deprecated "SCN-SHOP-007" and "SCN-CART-009"
    When the developer runs "spec-trace next-id SHOP"
    Then the command exits with code 0
    And the output is "SCN-SHOP-008"

  @id=SCN-TRACE-047 @status=implemented
  Scenario: next-id starts a new prefix at 001
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    When the developer runs "spec-trace next-id CART"
    Then the command exits with code 0
    And the output is "SCN-CART-001"

  @id=SCN-TRACE-048 @status=implemented
  Scenario: next-id starts a new prefix of a configured pattern
    Given a repository with a spec-trace.json with the ID pattern "^REQ-([A-Z]+)-\d{4}$"
    When the developer runs "spec-trace next-id SHOP"
    Then the command exits with code 0
    And the output is "REQ-SHOP-0001"

  @id=SCN-TRACE-049 @status=implemented
  Scenario: next-id asks for the first ID by hand when the pattern has no fixed width
    Given a repository with a spec-trace.json with the ID pattern "^REQ-([A-Z]+)-[0-9]+$"
    When the developer runs "spec-trace next-id SHOP"
    Then the command exits with code 2
    And the error output contains "spec-trace: cannot build a first ID for SHOP from ^REQ-([A-Z]+)-[0-9]+$"
