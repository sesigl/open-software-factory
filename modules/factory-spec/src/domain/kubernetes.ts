// The Kubernetes resources of one agent (ADR 0022): an Agent with the prompt as system message, a ModelConfig that
// points at the inference gateway, an MCPServer or RemoteMCPServer per MCP server, and an agent-sandbox
// SandboxTemplate for the agent's sandbox (ADR 0055).
import { stringify } from "yaml";
import type { McpServer } from "./mcp.ts";

/** The runtime of the agent, as factory.yaml declares it under `sandbox`. */
export interface SandboxInput {
  template: string;
  cpu?: number;
  memory?: string;
}

export interface KubernetesInput {
  factory: string;
  agent: string;
  model: string;
  prompt: string;
  servers: McpServer[];
  /** Base URL of the OpenAI-compatible inference gateway. */
  inference: string;
  sandbox?: SandboxInput;
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
  const sandbox = input.sandbox ? [sandboxTemplate(input.sandbox, metadata(input.agent))] : [];
  const header = '# Written by "factory render --k8s" from factory.yaml. Do not edit.\n';
  return header + [model, ...servers, agent, ...sandbox].map((resource) => stringify(resource)).join("---\n");
}

/**
 * The agent-sandbox SandboxTemplate the kubernetes sandbox adapter starts the agent's sandboxes from: one container
 * with the template as its image, and the CPU and memory as requests and limits (ADR 0055).
 */
function sandboxTemplate(sandbox: SandboxInput, metadata: unknown): unknown {
  const amounts = {
    ...(sandbox.cpu === undefined ? {} : { cpu: String(sandbox.cpu) }),
    ...(sandbox.memory === undefined ? {} : { memory: sandbox.memory }),
  };
  const resources = Object.keys(amounts).length ? { resources: { requests: amounts, limits: { ...amounts } } } : {};
  return {
    apiVersion: "extensions.agents.x-k8s.io/v1beta1",
    kind: "SandboxTemplate",
    metadata,
    spec: { podTemplate: { spec: { containers: [{ name: "sandbox", image: sandbox.template, ...resources }] } } },
  };
}
