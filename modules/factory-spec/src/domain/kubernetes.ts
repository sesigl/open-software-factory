// The kagent resources of one agent (ADR 0022): an Agent with the prompt as system message, a ModelConfig that
// points at the inference gateway, and an MCPServer or RemoteMCPServer per MCP server.
import { stringify } from "yaml";
import type { McpServer } from "./mcp.ts";

export interface KubernetesInput {
  factory: string;
  agent: string;
  model: string;
  prompt: string;
  servers: McpServer[];
  /** Base URL of the OpenAI-compatible inference gateway. */
  inference: string;
}

export function kagentResources(input: KubernetesInput): string {
  const metadata = (name: string) => ({
    name,
    labels: { "app.kubernetes.io/part-of": input.factory, "app.kubernetes.io/managed-by": "factory-spec" },
  });
  const servers = input.servers.map(({ name, launch }) =>
    "url" in launch
      ? {
          apiVersion: "kagent.dev/v1alpha2",
          kind: "RemoteMCPServer",
          metadata: metadata(name),
          spec: { description: name, protocol: "STREAMABLE_HTTP", url: launch.url },
        }
      : {
          apiVersion: "kagent.dev/v1alpha1",
          kind: "MCPServer",
          metadata: metadata(name),
          spec: {
            deployment: { cmd: launch.command, args: launch.args, port: 3000 },
            transportType: "stdio",
            stdioTransport: {},
          },
        },
  );
  const model = {
    apiVersion: "kagent.dev/v1alpha2",
    kind: "ModelConfig",
    metadata: metadata(input.agent),
    spec: {
      model: input.model,
      provider: "OpenAI",
      apiKeySecret: `${input.factory}-inference`,
      apiKeySecretKey: "OPENAI_API_KEY",
      openAI: { baseUrl: input.inference },
    },
  };
  const agent = {
    apiVersion: "kagent.dev/v1alpha2",
    kind: "Agent",
    metadata: metadata(input.agent),
    spec: {
      type: "Declarative",
      declarative: {
        modelConfig: input.agent,
        systemMessage: input.prompt,
        tools: servers.map((server) => ({
          type: "McpServer",
          mcpServer: { apiGroup: "kagent.dev", kind: server.kind, name: server.metadata.name },
        })),
      },
    },
  };
  const header = '# Written by "factory render --k8s" from factory.yaml. Do not edit.\n';
  return header + [model, ...servers, agent].map((resource) => stringify(resource)).join("---\n");
}
