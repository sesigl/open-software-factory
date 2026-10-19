@module=factory-spec @owner=maintainers
Feature: Render harness files
  "factory render" writes the files that each harness reads from one agent of factory.yaml: AGENTS.md from the
  prompt, the MCP servers in each harness's own format, and a link per skill in each harness's skill folder.

  @id=SCN-FSPEC-010 @status=implemented @realizes=SCN-FACTORY-OPEN-002
  Scenario: Render for Codex writes config.toml with the declared MCP servers
    Given a factory.yaml whose agent "implement" uses the harness "codex" and the MCP server "@modelcontextprotocol/server-filesystem@2025.8.21"
    When the factory engineer runs "factory render"
    Then the command exits with code 0
    And ".codex/config.toml" in the output folder has the section "[mcp_servers.\"server-filesystem\"]"
    And ".codex/config.toml" in the output folder has the line "args = [\"-y\",\"@modelcontextprotocol/server-filesystem@2025.8.21\"]"
    And "AGENTS.md" in the output folder is the prompt of "implement"

  @id=SCN-FSPEC-011 @status=implemented @realizes=SCN-FACTORY-OPEN-002
  Scenario: Render for every harness links each skill into the skill folder of each harness
    Given a factory.yaml that declares the harnesses "claude-code", "codex" and "opencode"
    And its agent "implement" has the skill "skills/testing"
    When the factory engineer runs "factory render --harness all"
    Then the command exits with code 0
    And ".claude/skills/testing/SKILL.md", ".agents/skills/testing/SKILL.md" and ".opencode/skills/testing/SKILL.md" in the output folder are the skill's SKILL.md
    And "CLAUDE.md" in the output folder is "@AGENTS.md"
    And "opencode.json" in the output folder starts the server "server-filesystem" as a local command

  @id=SCN-FSPEC-012 @status=implemented
  Scenario: Render removes the link of a skill the factory no longer declares
    Given a factory.yaml whose agent "implement" has the skill "skills/testing"
    And the factory engineer ran "factory render"
    And the factory engineer removed the skill "skills/testing" from factory.yaml
    When the factory engineer runs "factory render"
    Then the command exits with code 0
    And the output folder has no ".claude/skills/testing"

  @id=SCN-FSPEC-013 @status=implemented
  Scenario: Render asks for the agent when the factory has several
    Given a factory.yaml with the agents "triage" and "implement"
    When the factory engineer runs "factory render"
    Then the command exits with code 1
    And the output contains "factory.yaml declares 2 agents: choose one with --agent triage|implement"

  @id=SCN-FSPEC-014 @status=implemented
  Scenario: Render renders the agent named with --agent
    Given a factory.yaml with the agents "triage" and "implement"
    When the factory engineer runs "factory render --agent triage"
    Then the command exits with code 0
    And "AGENTS.md" in the output folder is the prompt of "triage"

  @id=SCN-FSPEC-015 @status=implemented
  Scenario: Render refuses a harness it cannot write
    Given a factory.yaml whose agent "triage" uses the declared harness "warp"
    When the factory engineer runs "factory render"
    Then the command exits with code 1
    And the output contains "factory render cannot write files for the harness \"warp\"; it writes claude-code, codex, opencode"
