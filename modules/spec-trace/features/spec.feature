@module=spec-trace @owner=maintainers
Feature: SPEC
  Every scenario has one ID that matches the pattern and its registered prefix, and one status.

  @id=SCN-TRACE-003 @status=planned
  Scenario: SPEC rejects a duplicate scenario ID
    Given a repository with two scenarios with the ID "SCN-SHOP-001"
    When the developer runs "spec-trace check --only SPEC"
    Then the command exits with code 1
    And the output contains "SPEC features/checkout.feature:10 duplicate ID SCN-SHOP-001, first at features/checkout.feature:4"

  @id=SCN-TRACE-004 @status=planned
  Scenario: SPEC rejects a scenario without a status
    Given a repository with the scenario "SCN-SHOP-001" without a @status tag
    When the developer runs "spec-trace check --only SPEC"
    Then the command exits with code 1
    And the output contains "SPEC features/checkout.feature:4 needs exactly one @status tag, has 0"

  @id=SCN-TRACE-005 @status=planned
  Scenario: SPEC rejects an unknown status
    Given a repository with the scenario "SCN-SHOP-001" tagged "@status=done"
    When the developer runs "spec-trace check --only SPEC"
    Then the command exits with code 1
    And the output contains "SPEC features/checkout.feature:4 @status=done is not one of planned, implemented, deprecated"

  @id=SCN-TRACE-006 @status=planned
  Scenario: SPEC rejects an ID that does not match the default pattern
    Given a repository with the scenario ID "SHOP-1"
    When the developer runs "spec-trace check --only SPEC"
    Then the command exits with code 1
    And the output contains "SPEC features/checkout.feature:4 ID SHOP-1 does not match ^SCN-([A-Z][A-Z0-9]*)-\d{3}$"

  @id=SCN-TRACE-007 @status=planned
  Scenario: SPEC accepts the IDs of a configured pattern
    Given a repository with the scenario ID "REQ-SHOP-0001"
    And a spec-trace.json with the ID pattern "^REQ-([A-Z]+)-\d{4}$"
    When the developer runs "spec-trace check --only SPEC"
    Then the command exits with code 0
    And the output contains "SPEC ok"

  @id=SCN-TRACE-008 @status=planned
  Scenario: SPEC rejects a prefix that is not registered
    Given a repository with the scenario "SCN-SHOP-001"
    And a spec-trace.json that registers only the prefix "CART" for "features/"
    When the developer runs "spec-trace check --only SPEC"
    Then the command exits with code 1
    And the output contains "SPEC features/checkout.feature:4 prefix SHOP is not registered in spec-trace.json"

  @id=SCN-TRACE-009 @status=planned
  Scenario: SPEC rejects a prefix outside the folder of its row in a Markdown table
    Given a repository with the scenario "SCN-SHOP-001"
    And a Markdown table in "docs/prefixes.md" that registers "SHOP" for "shop/features/" in line 3
    And a spec-trace.json whose prefixes are "docs/prefixes.md"
    When the developer runs "spec-trace check --only SPEC"
    Then the command exits with code 1
    And the output contains "SPEC features/checkout.feature:4 prefix SHOP belongs to shop/features/ (docs/prefixes.md:3)"

  @id=SCN-TRACE-010 @status=planned
  Scenario: SPEC names the line of a feature file that does not parse
    Given a repository with a feature file whose line 2 is a second "Feature:" line
    When the developer runs "spec-trace check --only SPEC"
    Then the command exits with code 1
    And the output contains "SPEC features/checkout.feature:2 Gherkin does not parse"
