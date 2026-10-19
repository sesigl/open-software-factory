// The Kubernetes resources of a factory (ADR 0022): per agent a kagent Agent and ModelConfig, per MCP server an
// MCPServer or RemoteMCPServer, and an agent-sandbox SandboxTemplate for an agent with a sandbox.
import type { FactoryDefinition } from "@opensoftware/contracts";
import type { McpServer } from "./mcp.ts";

export interface KubernetesSettings {
  /** Base URL of the inference gateway, the OpenAI-compatible endpoint every ModelConfig points at. */
  inferenceUrl: string;
  /** Registry folder of the sandbox images; the image is "<folder>/<sandbox.template>". */
  sandboxImages: string;
}

/** What the resources need of one agent besides its definition. */
export interface AgentInput {
  prompt: string;
  servers: McpServer[];
}

type Resource = Record<string, unknown>;

/** The resources by their file below the output folder, for example "k8s/agent-triage.yaml". */
export function kubernetesResources(
  definition: FactoryDefinition,
  inputs: Record<string, AgentInput>,
  settings: KubernetesSettings,
): Record<string, Resource> {
  const resources: Record<string, Resource> = {};
  const add = (apiVersion: string, kind: string, name: string, spec: unknown, annotations?: unknown): void => {
    const labels = { "app.kubernetes.io/part-of": definition.factory, "app.kubernetes.io/managed-by": "factory-spec" };
    const metadata = { name, labels, ...(annotations ? { annotations } : {}) };
    resources[`k8s/${kind.toLowerCase()}-${name}.yaml`] = { apiVersion, kind, metadata, spec };
  };
  for (const [name, agent] of Object.entries(definition.agents)) {
    const { prompt, servers } = inputs[name] as AgentInput;
    const tools = servers.map((server) => {
      const kind = "url" in server.launch ? "RemoteMCPServer" : "MCPServer";
      return { type: "McpServer", mcpServer: { apiGroup: "kagent.dev", kind, name: resourceName(server.name) } };
    });
    const declarative = { modelConfig: name, systemMessage: prompt, ...(tools.length > 0 ? { tools } : {}) };
    add("kagent.dev/v1alpha2", "Agent", name, {
      type: "Declarative",
      ...(agent.description ? { description: agent.description } : {}),
      declarative,
    });
    add("kagent.dev/v1alpha2", "ModelConfig", name, {
      provider: "OpenAI",
      model: agent.model,
      openAI: { baseUrl: settings.inferenceUrl },
    });
    for (const server of servers) mcpServer(server, add);
    if (agent.sandbox) {
      const { template, cpu, memory, egress } = agent.sandbox;
      const quantities = { ...(cpu ? { cpu: String(cpu) } : {}), ...(memory ? { memory } : {}) };
      const container = {
        name: "agent",
        image: `${settings.sandboxImages.replace(/\/$/, "")}/${template}`,
        ...(Object.keys(quantities).length > 0 ? { resources: { requests: quantities, limits: quantities } } : {}),
      };
      const annotations = egress ? { "opensoftware.dev/egress": egress.join(",") } : undefined;
      add(
        "extensions.agents.x-k8s.io/v1alpha1",
        "SandboxTemplate",
        name,
        { podTemplate: { spec: { containers: [container] } } },
        annotations,
      );
    }
  }
  return resources;
}

function mcpServer(
  server: McpServer,
  add: (apiVersion: string, kind: string, name: string, spec: unknown) => void,
): void {
  const name = resourceName(server.name);
  if ("url" in server.launch) {
    const protocol = server.transport === "sse" ? "SSE" : "STREAMABLE_HTTP";
    add("kagent.dev/v1alpha2", "RemoteMCPServer", name, { description: server.name, url: server.launch.url, protocol });
    return;
  }
  const deployment = { cmd: server.launch.command, args: server.launch.args, port: 3000 };
  add("kagent.dev/v1alpha1", "MCPServer", name, { deployment, transportType: "stdio", stdioTransport: {} });
}

/** A Kubernetes object name: lowercase letters, digits and hyphens. */
function resourceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
