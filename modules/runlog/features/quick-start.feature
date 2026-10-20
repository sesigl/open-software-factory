@module=runlog @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-RUN-001 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: A new user exports the sample Claude Code session from the README
    Given a Git repository with one commit and the sample Claude Code session from the README
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
    And the run in "runs.jsonl" has the root span "invoke_agent" with "gen_ai.conversation.id" "0f6c1d2e-3a4b-4c5d-8e9f-a0b1c2d3e4f5"

  @id=SCN-RUN-002 @status=implemented
  Scenario: The help lists every command
    When the user runs "runlog --help"
    Then the command exits with code 0
    And the output lists the command "export"
