@module=module-template @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-TEMPLATE-001 @status=implemented
  Scenario: A new user runs the quick start
    Given an empty working folder
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises

  @id=SCN-TEMPLATE-002 @status=implemented
  Scenario: The greeting names the user
    Given an empty working folder
    When the user runs "module-template hello Ada"
    Then the command exits with code 0
    And "$OUTPUT/hello.txt" holds the text "Hello, Ada"
    And the output names the file "$OUTPUT/hello.txt"

  @id=SCN-TEMPLATE-003 @status=implemented
  Scenario: A greeting without a name shows the usage
    Given an empty working folder
    When the user runs "module-template hello"
    Then the command exits with code 2
    And the output contains "usage: module-template hello <name>"
    And the output folder is empty

  @id=SCN-TEMPLATE-004 @status=implemented
  Scenario: An unknown command shows the usage
    Given an empty working folder
    When the user runs "module-template bye Ada"
    Then the command exits with code 2
    And the output contains "usage: module-template hello <name>"
