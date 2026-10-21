@module=spec-trace @owner=maintainers
Feature: changes since a base commit
  spec-trace report --base <commit> compares the scenarios of the current folder with the feature files of a base
  commit, so a review sees which requirements a change adds, removes or changes.

  @id=SCN-TRACE-050 @status=implemented
  Scenario: report lists a scenario added since the base commit
    Given a base commit with the implemented scenario "SCN-SHOP-001" and its test
    And the planned scenario "SCN-SHOP-002" added since the base commit
    When the developer runs "spec-trace report --base" with the base commit
    Then the command exits with code 0
    And the output ends with "since the base: 1 added, 0 removed, 0 with a new status, 0 with new steps"
    And the report lists "SCN-SHOP-002" as added since the base commit

  @id=SCN-TRACE-051 @status=implemented
  Scenario: report lists a scenario whose status changed since the base commit
    Given a base commit with the planned scenario "SCN-SHOP-001" and its test
    And the scenario "SCN-SHOP-001" marked implemented since the base commit
    When the developer runs "spec-trace report --base" with the base commit
    Then the command exits with code 0
    And the report lists "SCN-SHOP-001" with the status "planned" in the base and "implemented" now

  @id=SCN-TRACE-052 @status=implemented
  Scenario: report lists a scenario whose steps changed since the base commit
    Given a base commit with the implemented scenario "SCN-SHOP-001" and its test
    And the step "Then the order is paid" of "SCN-SHOP-001" changed to "Then the order is shipped" since the base commit
    When the developer runs "spec-trace report --base" with the base commit
    Then the command exits with code 0
    And the report lists "SCN-SHOP-001" as a scenario with new steps since the base commit

  @id=SCN-TRACE-053 @status=implemented
  Scenario: report lists a scenario removed since the base commit
    Given a base commit with the planned scenarios "SCN-SHOP-001" and "SCN-SHOP-002"
    And the scenario "SCN-SHOP-002" deleted since the base commit
    When the developer runs "spec-trace report --base" with the base commit
    Then the command exits with code 0
    And the report lists "SCN-SHOP-002" as removed since the base commit

  @id=SCN-TRACE-054 @status=implemented
  Scenario: report without --base has no changes
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    When the developer runs "spec-trace report"
    Then the command exits with code 0
    And the report has the changes null

  @id=SCN-TRACE-055 @status=implemented
  Scenario: report rejects a base that is not a commit of the repository
    Given a base commit with the implemented scenario "SCN-SHOP-001" and its test
    When the developer runs "spec-trace report --base 0000000000000000000000000000000000000001"
    Then the command exits with code 2
    And the error output contains "spec-trace: the base 0000000000000000000000000000000000000001 is not a commit of this repository"
