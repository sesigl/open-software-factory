@module=factory-spec @owner=maintainers
Feature: Render gh-aw workflows
  "factory render --gh-aw" writes one GitHub Agentic Workflow per automation that GitHub starts: an event filter
  that starts with "github." or a schedule. "gh aw compile" turns each file into a GitHub Actions workflow.
  Decision: ADR 0022.

  @id=SCN-FSPEC-039 @status=planned @realizes=SCN-FACTORY-AUTO-002
  Scenario: Render --gh-aw writes a workflow for an issue label automation
    Given a factory.yaml whose agent "implement" uses the harness "claude-code" and has the automation on "github.issue.labeled(auto-implement)"
    When the factory engineer runs "factory render --gh-aw"
    Then the command exits with code 0
    And ".github/workflows/issue-labeled-auto-implement.md" in the output folder starts on "issues" with the types "labeled" and the names "auto-implement"
    And its engine is "claude"
    And its body is the prompt of "implement"

  @id=SCN-FSPEC-040 @status=planned @realizes=SCN-FACTORY-AUTO-002
  Scenario: Render --gh-aw writes a scheduled workflow named after the agent it runs
    Given a factory.yaml with the agents "implement" and "self-triage-report" and the automation with the cron "0 10 * * *" that runs "self-triage-report"
    When the factory engineer runs "factory render --gh-aw"
    Then the command exits with code 0
    And ".github/workflows/self-triage-report.md" in the output folder starts on the schedule "0 10 * * *"
    And its body is the prompt of "self-triage-report"

  @id=SCN-FSPEC-041 @status=planned @realizes=SCN-FACTORY-RUNTIME-007
  Scenario: Render --gh-aw gives the workflow the MCP servers of its agent
    Given a factory.yaml whose agent "implement" uses the MCP server "@modelcontextprotocol/server-filesystem@2025.8.21" and has the automation on "github.issue.labeled(auto-implement)"
    When the factory engineer runs "factory render --gh-aw"
    Then the command exits with code 0
    And ".github/workflows/issue-labeled-auto-implement.md" in the output folder has the MCP server "server-filesystem" with the command "npx" and the arguments "-y" and "@modelcontextprotocol/server-filesystem@2025.8.21"

  @id=SCN-FSPEC-042 @status=planned
  Scenario: Render --gh-aw refuses an agent whose harness gh-aw cannot run
    Given a factory.yaml whose agent "implement" uses the harness "opencode" and has the automation on "github.issue.labeled(auto-implement)"
    When the factory engineer runs "factory render --gh-aw"
    Then the command exits with code 1
    And the error output contains "gh-aw cannot run the harness \"opencode\""
