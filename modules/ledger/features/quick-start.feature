@module=ledger @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-LEDGER-001 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: A new user computes the cost per pull request of the sample file from the README
    Given the sample file from the README
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
    And "report.json" shows 2 pull requests and a cost per pull request of 1.75 USD

  @id=SCN-LEDGER-002 @status=implemented
  Scenario: The help lists every command
    When the user runs "ledger --help"
    Then the command exits with code 0
    And the output lists the commands "ingest" and "report"
