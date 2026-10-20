@module=spec-trace @owner=maintainers
Feature: STEPS
  The labels of the given, when and then calls of a test match the steps of its scenario, in order, word for word.

  @id=SCN-TRACE-020 @status=planned
  Scenario: STEPS rejects a label that differs from the step
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And the test labels the step "When the guest pays with a card" as "the guest pays"
    When the developer runs "spec-trace check --only STEPS"
    Then the command exits with code 1
    And the output contains 'STEPS tests/SCN-SHOP-001.test.ts:5 when("the guest pays") differs from the step "When the guest pays with a card" (features/checkout.feature:6)'

  @id=SCN-TRACE-021 @status=planned
  Scenario: STEPS rejects a test that misses a step
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And the test has no step for "Then the order is paid"
    When the developer runs "spec-trace check --only STEPS"
    Then the command exits with code 1
    And the output contains 'STEPS tests/SCN-SHOP-001.test.ts:3 missing the step "Then the order is paid" of features/checkout.feature:4'

  @id=SCN-TRACE-022 @status=planned
  Scenario: STEPS rejects a step that the scenario does not have
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And the test has the extra step "then: an email is sent"
    When the developer runs "spec-trace check --only STEPS"
    Then the command exits with code 1
    And the output contains 'STEPS tests/SCN-SHOP-001.test.ts:7 then("an email is sent") has no step in features/checkout.feature:4'

  @id=SCN-TRACE-023 @status=planned
  Scenario: STEPS matches an outline parameter with any value
    Given a repository with the implemented scenario outline "SCN-SHOP-001" with the step "When the guest pays with <method>"
    And its test labels that step "the guest pays with a card"
    When the developer runs "spec-trace check --only STEPS"
    Then the command exits with code 0
    And the output contains "STEPS ok"

  @id=SCN-TRACE-024 @status=planned
  Scenario: STEPS puts the background steps first
    Given a repository with the background step "Given a shop with one book" and the implemented scenario "SCN-SHOP-001"
    And its test starts with the step "given: a shop with one book"
    When the developer runs "spec-trace check --only STEPS"
    Then the command exits with code 0
    And the output contains "STEPS ok"
