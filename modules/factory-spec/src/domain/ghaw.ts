// GitHub Agentic Workflows (gh-aw, ADR 0022): one Markdown workflow per automation that GitHub starts, with the
// trigger, the engine and the MCP servers in its front matter and the agent's prompt as its body.
import type { FactoryDefinition } from "@opensoftware/contracts";
import { stringify } from "yaml";
import { fail } from "./errors.ts";
import { githubTrigger, parseFilter } from "./events.ts";
import type { McpServer } from "./mcp.ts";

/** gh-aw engines by harness. */
const ENGINES: Record<string, string> = { "claude-code": "claude", codex: "codex" };

/** One automation as gh-aw runs it: the workflow's name, its trigger and the agent it runs. */
export interface Workflow {
  name: string;
  on: Record<string, unknown>;
  agent: string;
}

export function workflows(definition: FactoryDefinition): Workflow[] {
  const agents = Object.keys(definition.agents);
  const fallback = definition.workflow?.[0]?.agent ?? definition.workflow?.[0]?.stage ?? agents[0];
  return (definition.automations ?? []).flatMap((automation) => {
    const agent = automation.run && agents.includes(automation.run) ? automation.run : fallback;
    if (automation.cron) {
      return [
        { name: automation.run as string, on: { schedule: [{ cron: automation.cron }] }, agent: agent as string },
      ];
    }
    const filter = parseFilter(automation.on as string);
    if (filter.source !== "github") return [];
    const name = [filter.subject, filter.action, filter.argument].filter(Boolean).join("-");
    return [{ name: automation.run ?? slug(name), on: githubTrigger(automation.on as string), agent: agent as string }];
  });
}

/** The text of ".github/workflows/<name>.md". */
export function workflowFile(workflow: Workflow, harness: string, prompt: string, servers: McpServer[]): string {
  const engine =
    ENGINES[harness] ?? fail(`gh-aw cannot run the harness "${harness}"; it runs ${Object.keys(ENGINES).join(", ")}`);
  const mcp = Object.fromEntries(servers.map(({ name, launch }) => [name, launch]));
  const frontMatter = { on: workflow.on, engine, ...(servers.length > 0 ? { "mcp-servers": mcp } : {}) };
  return [
    "---",
    `# Written by "factory render --gh-aw" from factory.yaml. Do not edit. Compile it with "gh aw compile".`,
    stringify(frontMatter, { lineWidth: 0, aliasDuplicateObjects: false }).trimEnd(),
    "---",
    "",
    prompt,
  ].join("\n");
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
