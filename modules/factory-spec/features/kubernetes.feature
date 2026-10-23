@module=factory-spec @owner=maintainers
Feature: Render Kubernetes resources
  "factory render --k8s" writes the kagent resources of one agent to k8s/<agent>.yaml below $OUTPUT, for Argo CD
  or Flux to apply: an Agent with the prompt as its system message, a ModelConfig that points at the inference
  gateway, and one MCP server resource per MCP server.

  @id=SCN-FSPEC-040 @status=implemented @realizes=SCN-FACTORY-RUNTIME-007
  Scenario: Render for Kubernetes writes a kagent Agent and its ModelConfig
    Given a factory.yaml whose agent "triage" uses the model "routes/triage" and the prompt "agents/triage.md"
    When the factory engineer runs "factory render --k8s"
    Then the command exits with code 0
    And "k8s/triage.yaml" in the output folder has a kagent "Agent" "triage" whose system message is the prompt
    And it has a kagent "ModelConfig" "triage" with the model "routes/triage" at "http://litellm:4000/v1"

  @id=SCN-FSPEC-041 @status=implemented
  Scenario: Render for Kubernetes runs each npm MCP server as an MCPServer the Agent uses
    Given a factory.yaml whose agent "triage" uses the MCP server "@modelcontextprotocol/server-filesystem@2025.8.21"
    When the factory engineer runs "factory render --k8s"
    Then the command exits with code 0
    And "k8s/triage.yaml" in the output folder has an "MCPServer" "server-filesystem" that runs "npx" with "-y" and "@modelcontextprotocol/server-filesystem@2025.8.21"
    And the Agent "triage" uses the "MCPServer" "server-filesystem"

  @id=SCN-FSPEC-042 @status=implemented
  Scenario: Render for Kubernetes connects a remote registry server as a RemoteMCPServer
    Given a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/docs@2"
    And factory.lock pins it to the remote "https://mcp.acme.example/docs"
    When the factory engineer runs "factory render --k8s"
    Then the command exits with code 0
    And "k8s/triage.yaml" in the output folder has a "RemoteMCPServer" "docs" at "https://mcp.acme.example/docs"
    And the Agent "triage" uses the "RemoteMCPServer" "docs"

  @id=SCN-FSPEC-048 @status=implemented @realizes=SCN-FACTORY-RUNTIME-004
  Scenario: Render for Kubernetes writes an agent-sandbox SandboxTemplate for the agent's sandbox
    Given a factory.yaml whose agent "triage" runs in a sandbox with the template "node:24", the CPU 2 and the memory "4Gi"
    When the factory engineer runs "factory render --k8s"
    Then the command exits with code 0
    And "k8s/triage.yaml" in the output folder has a "SandboxTemplate" "triage" whose container "sandbox" runs "node:24"
    And the container requests and is limited to the CPU "2" and the memory "4Gi"
