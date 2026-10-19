@module=factory-spec @owner=maintainers
Feature: Render GitHub Agentic Workflows
  "factory render --gh-aw" writes one gh-aw workflow per automation that GitHub starts: "github.<object>.<action>(...)"
  events and cron schedules. Each workflow runs the agent with its prompt, harness and MCP servers.

  @id=SCN-FSPEC-043 @status=implemented @realizes=SCN-FACTORY-AUTO-002
  Scenario: Render for gh-aw writes a workflow for issues that get a label
    Given a factory.yaml whose agent "implement" on "claude-code" has the automation "github.issue.labeled(auto-implement)"
    When the factory engineer runs "factory render --gh-aw"
    Then the command exits with code 0
    And ".github/workflows/issue-labeled-auto-implement.md" in the output folder runs on issues with the type "labeled" and the label "auto-implement"
    And the workflow uses the engine "claude" and the prompt of "implement"

  @id=SCN-FSPEC-044 @status=implemented
  Scenario: Render for gh-aw writes a scheduled workflow for a cron automation
    Given a factory.yaml whose agent "implement" on "claude-code" has the automation cron "0 10 * * *" that runs "self-triage-report"
    When the factory engineer runs "factory render --gh-aw"
    Then the command exits with code 0
    And ".github/workflows/self-triage-report.md" in the output folder runs on the schedule "0 10 * * *"

  @id=SCN-FSPEC-045 @status=implemented
  Scenario: Render for gh-aw gives the workflow the agent's MCP servers
    Given a factory.yaml whose agent "implement" on "codex" uses the MCP server "@modelcontextprotocol/server-filesystem@2025.8.21"
    And it has the automation "github.issue.labeled(auto-implement)"
    When the factory engineer runs "factory render --gh-aw"
    Then the command exits with code 0
    And the workflow uses the engine "codex"
    And the workflow starts the MCP server "server-filesystem" with "npx" and allows all its tools

  @id=SCN-FSPEC-046 @status=implemented
  Scenario: Render for gh-aw refuses a harness gh-aw cannot run
    Given a factory.yaml whose agent "implement" on "opencode" has the automation "github.issue.labeled(auto-implement)"
    When the factory engineer runs "factory render --gh-aw"
    Then the command exits with code 1
    And the output contains "gh-aw has no engine for the harness \"opencode\"; it runs claude-code, codex"
