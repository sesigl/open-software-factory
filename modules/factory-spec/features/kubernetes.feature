@module=factory-spec @owner=maintainers
Feature: Render Kubernetes resources
  "factory render --k8s" writes the resources that run every agent of the factory on Kubernetes: a kagent Agent,
  its ModelConfig, one MCPServer or RemoteMCPServer per MCP server, and an agent-sandbox SandboxTemplate. Argo CD
  or Flux applies them. Decision: ADR 0022.

  @id=SCN-FSPEC-033 @status=implemented @realizes=SCN-FACTORY-OPEN-002
  Scenario: Render --k8s writes a kagent Agent with the prompt as its system message
    Given a factory.yaml whose agent "triage" has the prompt "agents/triage.md"
    When the factory engineer runs "factory render --k8s"
    Then the command exits with code 0
    And "k8s/agent-triage.yaml" in the output folder is a kagent Agent "triage" whose system message is the prompt of "triage"
    And the Agent "triage" uses the model config "triage"

  @id=SCN-FSPEC-034 @status=implemented @realizes=SCN-FACTORY-OPEN-001
  Scenario: Render --k8s writes a ModelConfig that sends the model to the inference gateway
    Given a factory.yaml whose agent "triage" uses the model "routes/triage"
    And FACTORY_INFERENCE_URL is "http://inference.osf.svc:4000/v1"
    When the factory engineer runs "factory render --k8s"
    Then the command exits with code 0
    And "k8s/modelconfig-triage.yaml" in the output folder is a ModelConfig "triage" with the model "routes/triage" and the base URL "http://inference.osf.svc:4000/v1"

  @id=SCN-FSPEC-035 @status=implemented @realizes=SCN-FACTORY-RUNTIME-007
  Scenario: Render --k8s runs an npm MCP server as an MCPServer and gives it to the agent as a tool
    Given a factory.yaml whose agent "triage" uses the MCP server "@modelcontextprotocol/server-filesystem@2025.8.21"
    When the factory engineer runs "factory render --k8s"
    Then the command exits with code 0
    And "k8s/mcpserver-server-filesystem.yaml" in the output folder is an MCPServer that runs "npx -y @modelcontextprotocol/server-filesystem@2025.8.21" over stdio
    And the Agent "triage" has the tool "MCPServer" named "server-filesystem"

  @id=SCN-FSPEC-036 @status=implemented @realizes=SCN-FACTORY-RUNTIME-007
  Scenario: Render --k8s connects a registry server with a remote URL as a RemoteMCPServer
    Given a factory.yaml whose agent "triage" uses the MCP server "registry:io.github.acme/tracker@1.4"
    And factory.lock pins it to the remote URL "https://tracker.example.com/mcp"
    When the factory engineer runs "factory render --k8s"
    Then the command exits with code 0
    And "k8s/remotemcpserver-tracker.yaml" in the output folder is a RemoteMCPServer with the URL "https://tracker.example.com/mcp" and the protocol "STREAMABLE_HTTP"
    And the Agent "triage" has the tool "RemoteMCPServer" named "tracker"

  @id=SCN-FSPEC-037 @status=implemented
  Scenario: Render --k8s writes an agent-sandbox SandboxTemplate with the declared resources and egress
    Given a factory.yaml whose agent "implement" has the sandbox template "node-24", 4 CPU, the memory "8Gi" and the egress host "registry.npmjs.org"
    And FACTORY_SANDBOX_IMAGES is "ghcr.io/acme/sandbox"
    When the factory engineer runs "factory render --k8s"
    Then the command exits with code 0
    And "k8s/sandboxtemplate-implement.yaml" in the output folder is a SandboxTemplate "implement" with the image "ghcr.io/acme/sandbox/node-24"
    And its container requests and is limited to the CPU "4" and the memory "8Gi"
    And it has the annotation "opensoftware.dev/egress" with the value "registry.npmjs.org"

  @id=SCN-FSPEC-038 @status=implemented @realizes=SCN-FACTORY-LOOP-013
  Scenario: Render --k8s writes the resources of every agent of the factory
    Given a factory.yaml with the agents "triage" and "implement"
    When the factory engineer runs "factory render --k8s"
    Then the command exits with code 0
    And the output folder contains "k8s/agent-triage.yaml" and "k8s/agent-implement.yaml"
