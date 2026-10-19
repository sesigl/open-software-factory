@module=testkit @owner=maintainers
Feature: Scripted coding agent
  fakes.harness is a coding agent that speaks the Agent Client Protocol (ACP) on stdio. A module starts it like
  any ACP agent; it performs the scripted file edits and reports the end of the turn, without a model.

  @id=SCN-TK-019 @status=implemented
  Scenario: The scripted harness applies its edit and reports completion over ACP
    Given a module whose CLI sends a prompt over ACP to the agent in "DEMO_AGENT_COMMAND" and prints the stop reason and the reply
    And its system test scripts fakes.harness to write "fixed" to "notes.md" and reply "done" when the prompt says "fix the typo"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-020 @status=implemented
  Scenario: A prompt the script does not name fails the scenario with the prompt shown
    Given a module whose CLI sends a prompt over ACP to the agent in "DEMO_AGENT_COMMAND" and prints the stop reason and the reply
    And its system test scripts fakes.harness for "fix the typo" but the module sends "delete everything"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "unscripted harness prompt:"
    And the output contains "delete everything"
