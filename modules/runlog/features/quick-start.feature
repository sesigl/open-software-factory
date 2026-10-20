@module=runlog @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-RUN-001 @status=implemented
  Scenario: A new user runs the quick start
    Given an empty working folder
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
