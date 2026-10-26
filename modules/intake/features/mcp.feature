@module=intake @owner=maintainers
Feature: The Factory MCP server
  "intake mcp" lets a local coding agent submit work and read its state over MCP on stdio, as a client of the API
  (ADR 0063).

  @id=SCN-INTAKE-017 @status=implemented @realizes=SCN-FACTORY-ACCESS-001
  Scenario: A local agent submits work through the Factory MCP server
    Given the server runs and "intake mcp" is connected to it as "github:varun"
    When the agent calls the tool "submit_work" with the title "Export reports as CSV"
    Then the tool answers a work item in the state "received"
    And "/v1/work-items/<id>" shows the requester "github:varun" and the origin "mcp"

  @id=SCN-INTAKE-018 @status=implemented
  Scenario: A local agent reads the state of a work item through the Factory MCP server
    Given the server received the README's "work.json" and "intake mcp" is connected to it as "github:varun"
    When the agent calls the tool "work_status" with the work item's ID
    Then the tool answers the work item with the title "Export reports as CSV" in the state "received"

  @id=SCN-INTAKE-019 @status=implemented
  Scenario: A tool call that the server refuses is a tool error with the server's reason
    Given the server runs and "intake mcp" is connected to it with a wrong API token
    When the agent calls the tool "submit_work" with the title "Export reports as CSV"
    Then the tool answers an error that says "the intake server answered 401"

  @id=SCN-INTAKE-020 @status=implemented
  Scenario: The MCP server without the server's URL exits with code 2 and names the variable
    Given an empty working folder
    When the user runs "intake mcp" without "INTAKE_URL"
    Then the command exits with code 2
    And the error output says "set INTAKE_URL"

  @id=SCN-INTAKE-034 @status=planned @realizes=SCN-FACTORY-ACCESS-002
  Scenario: A local agent fetches the evidence of a work item's run through the Factory MCP server
    Given the server knows the run "run_5d41402abc4b2a76b971" of the README's "work.json"
    And "intake mcp" is connected to it with "INTAKE_FOREMAN_URL" set to a foreman that has that run
    When the agent calls the tool "run_evidence" with the work item's ID
    Then the tool answers the run with its state, factory version, pull request and stages

  @id=SCN-INTAKE-035 @status=planned
  Scenario: The evidence of a work item without a run is a tool error
    Given the server received the README's "work.json" and "intake mcp" is connected to it with a foreman
    When the agent calls the tool "run_evidence" with the work item's ID
    Then the tool answers an error that says "has no run yet"

  @id=SCN-INTAKE-036 @status=planned
  Scenario: The evidence tool without the foreman's URL is a tool error that names the variable
    Given the server received the README's "work.json" and "intake mcp" is connected to it without "INTAKE_FOREMAN_URL"
    When the agent calls the tool "run_evidence" with the work item's ID
    Then the tool answers an error that says "set INTAKE_FOREMAN_URL"
