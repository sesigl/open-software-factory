@module=proof @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-PROOF-001 @status=planned @realizes=SCN-FACTORY-LOOP-008
  Scenario: A new user bundles the Playwright report from the README
    Given a Git repository with one commit, the Playwright report from the README and its trace
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
    And the bundle lists "artifacts/SCN-WEB-001/trace.zip" as "playwright-trace" for the scenario "SCN-WEB-001"

  @id=SCN-PROOF-002 @status=planned
  Scenario: The help lists every command
    When the user runs "proof --help"
    Then the command exits with code 0
    And the output lists the commands "bundle", "verify" and "attach"
