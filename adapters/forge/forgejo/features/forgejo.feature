@module=forge-forgejo @owner=maintainers
Feature: Usage errors of forge-forgejo
  forge-forgejo passes the forge port's scenarios in ports/forge/features/. These scenarios cover how it refuses
  arguments it cannot use (ADR 0057). A usage error exits with code 2 before the adapter calls the forge. The test
  forge is the testkit's Forgejo.

  @id=SCN-FFORGEJO-001 @status=implemented
  Scenario: A pull request number that is not a whole number above 0 is a usage error
    Given the repository "tester/web"
    When the client runs "pr tester/web 0" and "pr tester/web 1.5"
    Then both exit with code 2 and the error "forge-forgejo: name the pull request by its number, like 7"

  @id=SCN-FFORGEJO-002 @status=implemented
  Scenario: A webhook ID that is not a whole number above 0 is a usage error
    Given the repository "tester/web"
    When the client runs "unhook tester/web 0" and "unhook tester/web 1.5"
    Then both exit with code 2 and the error "forge-forgejo: name the webhook by its ID, like unhook tester/web 7"

  @id=SCN-FFORGEJO-003 @status=implemented
  Scenario: An approval count that is not a whole number from 0 is a usage error
    Given the repository "tester/web"
    When the client runs "protect tester/web main --approvals=-1" and "protect tester/web main --approvals=1.5"
    Then both exit with code 2 and the error "forge-forgejo: --approvals takes a number, like --approvals 1"

  @id=SCN-FFORGEJO-004 @status=implemented
  Scenario: A check without its name is a usage error
    Given the repository "tester/web"
    When the client runs "check tester/web 9b1c2d3" without the check's name and state
    Then check exits with code 2 and the error "forge-forgejo: name the commit and the check, like check tester/web 9b1c2d3 verify success"

  @id=SCN-FFORGEJO-005 @status=implemented
  Scenario: A check state that the port does not know is a usage error
    Given the repository "tester/web"
    When the client runs "check tester/web 9b1c2d3 verify done"
    Then check exits with code 2 and the error "forge-forgejo: the state is one of pending, success, failure, error"

  @id=SCN-FFORGEJO-006 @status=implemented
  Scenario: A command with one word too many is a usage error
    Given the repository "tester/web"
    When the client runs "check tester/web 9b1c2d3 verify success extra" with one word too many
    Then check exits with code 2, prints nothing and writes the usage to the error output
