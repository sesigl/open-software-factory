@module=factory-spec @owner=maintainers
Feature: Plan, apply, diff and resolve
  "factory plan" shows what "factory apply" would change compared with the last applied version, one line per
  changed value, and reports rendered files changed by hand as drift. Rolling back is applying an older version.

  @id=SCN-FSPEC-022 @status=planned @realizes=SCN-FACTORY-CODE-003
  Scenario: Plan of a factory that was never applied shows the factory as added
    Given a factory.yaml of the factory "web-app" with the agent "triage"
    And the factory was never applied
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output contains "+ factory: \"web-app\""
    And the output contains "Plan: 5 to add, 0 to change, 0 to remove, 0 drifted."

  @id=SCN-FSPEC-023 @status=planned @realizes=SCN-FACTORY-CODE-003
  Scenario: Apply renders the files and prints the applied version
    Given a factory.yaml of the factory "web-app" with the agent "triage"
    When the factory engineer runs "factory apply"
    Then the command exits with code 0
    And the output starts with "Applied factory web-app version "
    And the output folder contains "AGENTS.md" and ".mcp.json"

  @id=SCN-FSPEC-024 @status=planned
  Scenario: Plan after apply shows no changes
    Given the factory "web-app" was applied with the agent "triage"
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output is "No changes."

  @id=SCN-FSPEC-025 @status=planned @realizes=SCN-FACTORY-OPEN-001
  Scenario: Plan shows a model change as one diff line
    Given the factory "web-app" was applied with the agent "triage" on the model "routes/triage"
    And the factory engineer set the model of "triage" to "routes/fast" in factory.yaml
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output has exactly one change line, "~ agents.triage.model: \"routes/triage\" -> \"routes/fast\""
    And the output contains "Plan: 0 to add, 1 to change, 0 to remove, 0 drifted."

  @id=SCN-FSPEC-026 @status=planned @realizes=SCN-FACTORY-CODE-004
  Scenario: Plan shows a changed prompt
    Given the factory "web-app" was applied with the agent "triage"
    And the factory engineer changed the text of "agents/triage.md"
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output contains "~ prompts.agents/triage.md:"

  @id=SCN-FSPEC-027 @status=planned
  Scenario: Plan reports a rendered file changed by hand as drift
    Given the factory "web-app" was applied with the agent "triage"
    And a person edited "AGENTS.md" in the output folder
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And the output contains "! AGENTS.md changed outside \"factory apply\""
    And the output contains "Plan: 0 to add, 0 to change, 0 to remove, 1 drifted."

  @id=SCN-FSPEC-028 @status=planned @realizes=SCN-FACTORY-CODE-005
  Scenario: Applying an older version rolls the rendered files back
    Given the factory "web-app" was applied with the prompt text "Version two"
    And the factory engineer restored the prompt text "Version one"
    When the factory engineer runs "factory apply"
    Then the command exits with code 0
    And "AGENTS.md" in the output folder is "Version one"

  @id=SCN-FSPEC-029 @status=planned @realizes=SCN-FACTORY-CODE-004
  Scenario: Diff shows the changes between a Git revision and the working copy
    Given factory.yaml with the model "routes/triage" is committed
    And the working copy sets the model to "routes/fast" and adds the agent "review"
    When the factory engineer runs "factory diff HEAD:factory.yaml"
    Then the command exits with code 0
    And the output contains "~ agents.triage.model: \"routes/triage\" -> \"routes/fast\""
    And the output contains "+ agents.review:"

  @id=SCN-FSPEC-030 @status=planned
  Scenario: Diff of two equal versions shows no changes
    Given two files "v1.yaml" and "v2.yaml" with the same factory
    When the factory engineer runs "factory diff v1.yaml v2.yaml"
    Then the command exits with code 0
    And the output is "No changes."

  @id=SCN-FSPEC-031 @status=planned @realizes=SCN-FACTORY-LOOP-013
  Scenario: Resolve prints the definition with defaults and pins
    Given a factory.yaml whose stage "spec" names no agent and whose scorer "redundant-tests" has no sample
    And its agent "spec" uses the MCP server "registry:io.github.acme/tracker@1.4", which factory.lock pins to "1.4.2"
    When the factory engineer runs "factory resolve"
    Then the command exits with code 0
    And the printed definition is a valid factory-definition
    And it runs the stage "spec" with the agent "spec"
    And it samples the scorer "redundant-tests" at 1
    And it lists the MCP server "registry:io.github.acme/tracker@1.4.2"
