// intake mcp: the Factory MCP server on stdio for a local coding agent, a client of the API (ADR 0063), and of the
// foreman's API for a run's evidence (ADR 0071).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { packageVersion } from "@opensoftware/cli";
import { type Answer, type Api, foremanRun, intakeApi } from "../adapters/api.ts";
import { type Env, required } from "./env.ts";

/** The input of the tools that read one work item. */
const BY_ID = {
  type: "object" as const,
  properties: { id: { type: "string", description: "The work item's ID, like wi_…" } },
  required: ["id"],
};

const TOOLS = [
  {
    name: "submit_work",
    description:
      "Put work into the factory's inbox. Work with the same dedupe key is one work item. Answers the work item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "What should be done, in one line." },
        description: { type: "string", description: "Details for the agents that do the work." },
        type: { type: "string", enum: ["idea", "bug", "task", "automation"], description: "Default: task." },
        dedupeKey: { type: "string", description: "Default: mcp:<requester>:<title>." },
      },
      required: ["title"],
    },
  },
  {
    name: "work_status",
    description: "The state of a work item and every request that asked for it.",
    inputSchema: BY_ID,
  },
  {
    name: "run_evidence",
    description:
      "What the foreman recorded of a work item's run: its state, factory version, pull request, and each stage with " +
      "its agent, state, harness session, gate, checks and reason.",
    inputSchema: BY_ID,
  },
];

/** A view as the tool's text; any status but 200 and 201 is a tool error with the problem's detail. */
function toolResult({ status, body }: Answer, server = "the intake server") {
  if (status === 200 || status === 201) return { content: [{ type: "text", text: JSON.stringify(body) }] };
  const detail = (body as { detail?: string } | undefined)?.detail;
  return toolError(`${server} answered ${status}${detail ? `: ${detail}` : ""}`);
}

const toolError = (text: string) => ({ isError: true, content: [{ type: "text", text }] });

/** The run view of the work item's run, from the foreman at INTAKE_FOREMAN_URL. */
async function evidence(api: Api, env: Env, id: string) {
  const foreman = env.INTAKE_FOREMAN_URL;
  if (!foreman) return toolError("set INTAKE_FOREMAN_URL: the base URL of foreman serve, for run_evidence");
  const answer = await api.workItem(id);
  if (answer.status !== 200) return toolResult(answer);
  const { runId } = answer.body as { runId?: string };
  if (!runId) return toolError(`work item ${id} has no run yet`);
  return toolResult(await foremanRun(foreman, `${env.INTAKE_FOREMAN_TOKEN}`, runId), "the foreman");
}

export async function mcp(env: Env) {
  const url = required(env, "INTAKE_URL", "the base URL of intake serve");
  const token = required(env, "INTAKE_API_TOKEN", "the token of intake serve's API");
  const requester = required(env, "INTAKE_REQUESTER", "the person the agent works for, like github:varun");
  const api = intakeApi(url, token);

  const server = new Server(
    { name: "intake", version: packageVersion(new URL("../../package.json", import.meta.url)) },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  const submit = (input: Record<string, string | undefined>) =>
    api.submit({
      type: input.type,
      title: input.title,
      description: input.description,
      requester: { kind: "person", id: requester },
      origin: { source: "mcp" },
      dedupeKey: input.dedupeKey ?? `mcp:${requester}:${input.title}`,
    });
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    const input = (params.arguments ?? {}) as Record<string, string | undefined>;
    if (params.name === "run_evidence") return evidence(api, env, String(input.id));
    return toolResult(await (params.name === "work_status" ? api.workItem(String(input.id)) : submit(input)));
  });

  const transport = new StdioServerTransport();
  const closed = new Promise<void>((resolve) => process.stdin.once("end", resolve));
  await server.connect(transport);
  await closed;
  return { lines: [] };
}
