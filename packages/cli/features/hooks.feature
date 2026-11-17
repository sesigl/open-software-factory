@module=cli @owner=maintainers
Feature: Test hooks need the test switch
  A test hook is an environment variable that only the system tests set, like OSF_NOW for the clock or OSF_SEED for
  the random source. testHook gives its value only when OSF_TEST_HOOKS is 1, which the testkit sets for every module
  process it starts; a process that an operator starts with a test hook refuses it (ADR 0166).

  @id=SCN-CLI-021 @status=implemented
  Scenario: testHook gives the value of a test hook when OSF_TEST_HOOKS is 1
    Given an environment with "OSF_TEST_HOOKS" set to "1" and "OSF_NOW" set to "2026-01-01T00:00:00Z"
    When the module asks testHook for "OSF_NOW" and "OSF_SEED"
    Then it gives "2026-01-01T00:00:00Z" for "OSF_NOW"
    And it gives no value for "OSF_SEED"

  @id=SCN-CLI-022 @status=implemented
  Scenario: A test hook without OSF_TEST_HOOKS set to 1 is a usage error that names it
    Given the program "demo" whose command asks testHook for "OSF_NOW" in an environment with "OSF_NOW" set to "2026-01-01T00:00:00Z", once without "OSF_TEST_HOOKS" and once with it set to "true"
    When the module runs the program in each environment
    Then each exit code is 2
    And each standard error is "demo: OSF_NOW is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests: unset OSF_NOW"

  @id=SCN-CLI-023 @status=implemented
  Scenario: Without OSF_TEST_HOOKS a test hook that is unset or empty gives no value
    Given an environment without "OSF_TEST_HOOKS", once without "OSF_NOW" and once with "OSF_NOW" set to ""
    When the module asks testHook for "OSF_NOW" in each environment
    Then it gives no value in each environment
