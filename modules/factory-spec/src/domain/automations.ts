// Automations of factory.yaml as forge webhooks and gh-aw workflows (ADR 0022). An event filter is
// "<source>.<object>[.<action>][(<argument>)]", for example "github.issue.labeled(auto-implement)".
import type { FactoryDefinition } from "@opensoftware/contracts";
import { stringify } from "yaml";
import { fail } from "./errors.ts";
import type { McpServer } from "./mcp.ts";

export interface EventFilter {
  source: string;
  object: string;
  action?: string;
  argument?: string;
}

export function parseFilter(filter: string): EventFilter {
  const [, source = "", object = "", action, argument] =
    /^([\w-]+)\.(\w+)(?:\.(\w+))?(?:\((.*)\))?$/.exec(filter) ?? fail(`"${filter}" is not an event filter`);
  return { source, object, action, argument };
}

/** The forges whose automations factory-spec registers webhooks for. */
export type WebhookSource = "forgejo" | "github";

/** One webhook a forge needs: the repository and the port's events, "<object>[.<action>]" (ADR 0060). */
export interface WebhookTarget {
  source: WebhookSource;
  repository: string;
  events: string[];
}

/**
 * The webhooks the automations need: for each forge with automations, one per repository the agents operate on.
 * GitHub starts the automations of gh-aw workflows itself, so `ghAw` leaves GitHub out.
 */
export function webhookTargets(definition: FactoryDefinition, ghAw: boolean): WebhookTarget[] {
  const filters = (definition.automations ?? []).flatMap((automation) =>
    automation.on ? [parseFilter(automation.on)] : [],
  );
  const repositories = [
    ...new Set(Object.values(definition.agents).flatMap((agent) => agent.repositories ?? [])),
  ].sort();
  const sources: WebhookSource[] = ghAw ? ["forgejo"] : ["forgejo", "github"];
  return sources.flatMap((source) => {
    const names = filters
      .filter((filter) => filter.source === source)
      .map(({ object, action }) => (action ? `${object}.${action}` : object));
    const events = [...new Set(names)].sort();
    return events.length === 0 ? [] : repositories.map((repository) => ({ source, repository, events }));
  });
}

/** GitHub Actions events by object; other objects keep their name. */
const GITHUB_EVENTS: Record<string, string> = { issue: "issues" };
const ENGINES: Record<string, string> = { "claude-code": "claude", codex: "codex" };

/** One gh-aw workflow per automation GitHub starts, by its path below the output folder. */
export function ghAwWorkflows(
  definition: FactoryDefinition,
  harness: string,
  prompt: string,
  servers: McpServer[],
): Record<string, string> {
  const engine =
    ENGINES[harness] ??
    fail(`gh-aw has no engine for the harness "${harness}"; it runs ${Object.keys(ENGINES).join(", ")}`);
  const mcp = Object.fromEntries(servers.map(({ name, launch }) => [name, { ...launch, allowed: ["*"] }]));
  const workflows: Record<string, string> = {};
  for (const automation of definition.automations ?? []) {
    const filter = automation.on ? parseFilter(automation.on) : undefined;
    if (filter && filter.source !== "github") continue;
    const on = filter
      ? {
          [GITHUB_EVENTS[filter.object] ?? filter.object]: {
            ...(filter.action && { types: [filter.action] }),
            ...(filter.argument && { names: filter.argument.split(",").map((name) => name.trim()) }),
          },
        }
      : { schedule: [{ cron: automation.cron }] };
    const name = filter ? [filter.object, filter.action, filter.argument].filter(Boolean).join("-") : automation.run;
    const frontmatter = stringify({ on, engine, ...(servers.length > 0 && { "mcp-servers": mcp }) });
    const header = '# Written by "factory render" from factory.yaml. Do not edit.';
    workflows[`.github/workflows/${slug(name as string)}.md`] = `---\n${header}\n${frontmatter}---\n\n${prompt}`;
  }
  return workflows;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
