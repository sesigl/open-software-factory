@module=spec-trace @owner=maintainers
Feature: check
  spec-trace check runs the rules on the repository in the current folder, configured by spec-trace.json.

  @id=SCN-TRACE-032 @status=planned
  Scenario: check runs every rule on a traced repository
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    And a JUnit report in which the test of "SCN-SHOP-001" passed
    When the developer runs "spec-trace check"
    Then the command exits with code 0
    And the output is the lines "SPEC ok", "TRACE ok", "STEPS ok" and "PASS ok"

  @id=SCN-TRACE-033 @status=planned
  Scenario: check rejects an unknown rule
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    When the developer runs "spec-trace check --only SPEC,LINT"
    Then the command exits with code 2
    And the error output contains "spec-trace: unknown rule LINT; known: SPEC, TRACE, STEPS, PASS"

  @id=SCN-TRACE-034 @status=planned
  Scenario: check rejects an unknown key in spec-trace.json
    Given a repository with a spec-trace.json with the key "feature"
    When the developer runs "spec-trace check"
    Then the command exits with code 2
    And the error output contains 'spec-trace: spec-trace.json: unknown key "feature"'

  @id=SCN-TRACE-035 @status=planned
  Scenario: check rejects a key of the wrong type in spec-trace.json
    Given a repository with a spec-trace.json whose "tests" is the text "*.test.ts"
    When the developer runs "spec-trace check"
    Then the command exits with code 2
    And the error output contains 'spec-trace: spec-trace.json: "tests" must be a list of globs'

  @id=SCN-TRACE-036 @status=planned
  Scenario: check reads the configuration file named by --config
    Given a repository with the scenario ID "REQ-SHOP-0001"
    And a file "ci/trace.json" with the ID pattern "^REQ-([A-Z]+)-\d{4}$"
    When the developer runs "spec-trace check --only SPEC --config ci/trace.json"
    Then the command exits with code 0
    And the output contains "SPEC ok"

  @id=SCN-TRACE-037 @status=planned
  Scenario: check rejects a configuration file that does not exist
    Given a repository with the implemented scenario "SCN-SHOP-001" and its test
    When the developer runs "spec-trace check --config missing.json"
    Then the command exits with code 2
    And the error output contains "spec-trace: missing.json does not exist"

  @id=SCN-TRACE-038 @status=planned
  Scenario: check rejects a prefix file that does not exist
    Given a repository with a spec-trace.json whose prefixes are "docs/prefixes.md" and no such file
    When the developer runs "spec-trace check"
    Then the command exits with code 2
    And the error output contains "spec-trace: spec-trace.json: the prefix file docs/prefixes.md does not exist"
