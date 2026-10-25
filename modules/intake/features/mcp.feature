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
