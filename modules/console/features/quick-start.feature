@module=console @owner=maintainers
Feature: Quick start
  "console serve" shows a factory's runs as web pages, from the foreman's API (ADR 0072).

  @id=SCN-CONSOLE-001 @status=planned @realizes=SCN-FACTORY-VIS-001
  Scenario: A new user opens the runs page of the quick start
    Given a foreman whose API has the run "Export reports as CSV"
    When the user starts "console serve" as the README says and opens "/"
    Then the page answers 200 and lists the run "Export reports as CSV" in the state "running"

  @id=SCN-CONSOLE-002 @status=planned
  Scenario: The help lists every command
    When the user runs "console --help"
    Then the command exits with code 0
    And the output names the command "serve"

  @id=SCN-CONSOLE-003 @status=planned
  Scenario: An unknown command shows the usage
    When the user runs "console show"
    Then the command exits with code 2
    And the output contains "Usage: console <command>"

  @id=SCN-CONSOLE-004 @status=planned
  Scenario: Serve without a foreman exits 2 and names the variable
    When the user runs "console serve" without "CONSOLE_FOREMAN_URL"
    Then the command exits with code 2
    And the output contains "set CONSOLE_FOREMAN_URL"
