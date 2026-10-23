@module=testkit @owner=maintainers
Feature: Scripted coding agent
  fakes.harness is a coding agent that speaks the Agent Client Protocol (ACP) on stdio. A module starts it like
  any ACP agent; it performs the scripted file edits and reports the end of the turn, without a model. A turn can
  also ask to approve tool calls, wait for a steering message, ignore a cancel and end with another stop reason
  (ADR 0050).

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

  @id=SCN-TK-059 @status=implemented
  Scenario: The scripted harness asks to approve its tool calls and writes nothing when one is refused
    Given a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that refuses every tool call
    And its system test scripts fakes.harness to run the tool "rm -rf build" of kind "execute" and write "gone" to "notes.md" for "clean up", and expects the tool call refused and no "notes.md"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-060 @status=implemented
  Scenario: A scripted turn waits for a steering message and then goes on
    Given a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "add a date" and then "use the existing date helper" while the first turn runs
    And its system test scripts fakes.harness to keep the turn of "add a date" running until it receives "use the existing date helper", and expects both turns to end with "end_turn"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-061 @status=implemented
  Scenario: A waiting scripted turn ends with "cancelled" when the session is cancelled
    Given a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "add a date" and cancels the session
    And its system test scripts fakes.harness to keep the turn of "add a date" running until it receives "never", and expects "add a date: cancelled"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-062 @status=implemented
  Scenario: A scripted turn that ignores cancel keeps running
    Given a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "add a date", cancels the session, waits 500 ms and stops the agent
    And its system test scripts fakes.harness to keep the turn of "add a date" running and to ignore cancel, and expects no end of the turn
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-063 @status=implemented
  Scenario: A scripted turn ends with its scripted stop reason
    Given a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "write a novel"
    And its system test scripts fakes.harness to end the turn of "write a novel" with "max_tokens", and expects "write a novel: max_tokens"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-070 @status=implemented
  Scenario: A scripted turn reports its token usage and the session's cost
    Given a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "fix the typo" and prints the turn's usage and the session's cost
    And its system test scripts fakes.harness to report 1000 input tokens, 200 output tokens and a cost of 0.25 USD for "fix the typo", and expects "usage 1000 200 1200" and "cost 0.25 USD"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
