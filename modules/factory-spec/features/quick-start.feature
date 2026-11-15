@module=factory-spec @owner=maintainers
Feature: Quick start
  The five-minute quick start from the README works for a new user.

  @id=SCN-FSPEC-001 @status=implemented @realizes=SCN-FACTORY-CODE-001
  Scenario: A new user renders the sample factory from the README
    Given a working folder with the sample factory from the README
    When the user runs the quick start command from the README
    Then the command exits with code 0
    And the output folder contains the file the README promises
    And ".mcp.json" in the output folder starts the server "server-filesystem" with "npx"

  @id=SCN-FSPEC-032 @status=implemented
  Scenario: The help lists every command
    When the user runs "factory --help"
    Then the command exits with code 0
    And the output lists the commands "lint", "render", "plan", "apply", "diff" and "resolve"

  @id=SCN-FSPEC-119 @status=implemented
  Scenario: A command that factory does not have prints the help and exits with code 2
    When the user runs "factory deploy", "factory toString" and "factory constructor"
    Then each command exits with code 2
    And each output starts with "factory: one factory.yaml rendered for every harness" and lists the command "lint"
