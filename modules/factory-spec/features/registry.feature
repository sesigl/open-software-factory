@module=factory-spec @owner=maintainers
Feature: Pin MCP servers from the registry
  An MCP server "registry:<name>@<range>" comes from the MCP Registry. "factory plan" pins the exact version, its
  package or remote URL in factory.lock once; render and later plans read only the lock.

  @id=SCN-FSPEC-016 @status=implemented @realizes=SCN-FACTORY-RUNTIME-007
  Scenario: Plan pins an MCP server from the registry to an exact version in factory.lock
    Given a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"
    And the MCP Registry lists the versions "1.3.0", "1.4.0", "1.4.2" and "2.0.0" of "io.github.acme/tracker"
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And "factory.lock" pins "registry:io.github.acme/tracker@1.4" to the version "1.4.2" and the npm package "@acme/tracker-mcp@1.4.2"

  @id=SCN-FSPEC-017 @status=implemented
  Scenario: Plan uses the version factory.lock pins without calling the registry
    Given a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"
    And factory.lock pins it to the version "1.4.2"
    And the MCP Registry answers no request
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And "factory.lock" still pins "registry:io.github.acme/tracker@1.4" to the version "1.4.2"

  @id=SCN-FSPEC-018 @status=implemented
  Scenario: Render starts a registry server with the package version factory.lock pins
    Given a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"
    And factory.lock pins it to the npm package "@acme/tracker-mcp@1.4.2"
    When the factory engineer runs "factory render"
    Then the command exits with code 0
    And ".mcp.json" in the output folder starts the server "tracker" with the arguments "-y" and "@acme/tracker-mcp@1.4.2"

  @id=SCN-FSPEC-019 @status=implemented
  Scenario: Render connects to a registry server by the remote URL factory.lock pins
    Given a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/docs@2"
    And the MCP Registry lists the version "2.1.0" of "io.github.acme/docs" with the remote "https://mcp.acme.example/docs"
    And the factory engineer ran "factory plan"
    When the factory engineer runs "factory render --harness all"
    Then the command exits with code 0
    And ".mcp.json" in the output folder connects the server "docs" to "https://mcp.acme.example/docs"
    And ".codex/config.toml" in the output folder has the line "url = \"https://mcp.acme.example/docs\""

  @id=SCN-FSPEC-020 @status=implemented
  Scenario: Render asks for a plan when factory.lock has no entry for a registry server
    Given a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"
    And the working folder has no factory.lock
    When the factory engineer runs "factory render"
    Then the command exits with code 1
    And the output contains "factory.lock has no entry for \"registry:io.github.acme/tracker@1.4\": run \"factory plan\""

  @id=SCN-FSPEC-021 @status=implemented
  Scenario: Plan reports a range that no registry version matches
    Given a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@3"
    And the MCP Registry lists the versions "1.4.2" and "2.0.0" of "io.github.acme/tracker"
    When the factory engineer runs "factory plan"
    Then the command exits with code 1
    And the output contains "the MCP Registry has no version of \"io.github.acme/tracker\" that matches \"3\""

  @id=SCN-FSPEC-066 @status=implemented
  Scenario: Plan with --adapters pins each adapter under providers to the newest npm version in its range
    Given a factory.yaml with "claude-code" at "^2" under "providers.harness" and "github" at "^0" under "providers.forge"
    And the npm registry lists the versions "1.9.0", "2.0.0", "2.3.1" and "3.0.0" of "@opensoftware/harness-claude-code"
    And it lists the versions "0.2.0" and "0.3.1" of "@opensoftware/forge-github"
    When the factory engineer runs "factory plan --adapters"
    Then the command exits with code 0
    And "factory.lock" pins the harness "claude-code" at "^2" to "2.3.1" and the forge "github" at "^0" to "0.3.1"

  @id=SCN-FSPEC-067 @status=implemented
  Scenario: Plan keeps an adapter's pin while its range is unchanged, and pins it again after the range changed
    Given a factory.yaml with "claude-code" at "^2" under "providers.harness" and "github" at "^1" under "providers.forge"
    And factory.lock pins the harness "claude-code" at "^2" to "2.0.0" and the forge "github" at "^0" to "0.3.1"
    And the npm registry lists only the versions "0.3.1" and "1.2.0" of "@opensoftware/forge-github"
    When the factory engineer runs "factory plan --adapters"
    Then the command exits with code 0
    And "factory.lock" pins the harness "claude-code" at "^2" to "2.0.0" and the forge "github" at "^1" to "1.2.0"

  @id=SCN-FSPEC-068 @status=implemented
  Scenario: Plan without --adapters keeps the adapter pins of factory.lock and calls no registry
    Given a factory.yaml with "claude-code" at "^2" under "providers.harness"
    And factory.lock pins the harness "claude-code" at "^2" to "2.0.0"
    And the npm registry answers no request
    When the factory engineer runs "factory plan"
    Then the command exits with code 0
    And "factory.lock" still pins the harness "claude-code" at "^2" to "2.0.0"

  @id=SCN-FSPEC-069 @status=implemented
  Scenario: Plan with --adapters reports a range that no npm version matches
    Given a factory.yaml with "claude-code" at "^4" under "providers.harness"
    And the npm registry lists the versions "2.3.1" and "3.0.0" of "@opensoftware/harness-claude-code"
    When the factory engineer runs "factory plan --adapters"
    Then the command exits with code 1
    And the output contains "the npm registry has no version of \"@opensoftware/harness-claude-code\" that matches \"^4\""
