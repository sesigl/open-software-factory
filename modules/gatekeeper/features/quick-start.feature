@module=gatekeeper @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-GATE-001 @status=planned @realizes=SCN-FACTORY-ORCH-003
  Scenario: A new user asks for approval in Slack with the files from the README
    Given the policy, the groups and the request from the README
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
    And the Slack channel "C0GATES" has a message that asks "maintainers" to approve "Merge the new checkout flow"

  @id=SCN-GATE-002 @status=planned
  Scenario: The help lists every command
    When the user runs "gatekeeper --help"
    Then the command exits with code 0
    And the output lists the commands "request", "status" and "verify"

  @id=SCN-GATE-003 @status=planned
  Scenario: An unknown command shows the usage
    When the user runs "gatekeeper approve"
    Then the command exits with code 2
    And the error output starts with "Usage: gatekeeper <command>"
