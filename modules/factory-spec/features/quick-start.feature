@module=factory-spec @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-FSPEC-001 @status=planned @realizes=SCN-FACTORY-CODE-001
  Scenario: A new user renders the sample factory from the README
    Given a working folder with the sample factory from the README
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
    And ".mcp.json" in the output folder starts the server "server-filesystem" with "npx"
