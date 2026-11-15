// The data of the configuration pages "/factory" and "/factory/agents/<name>" (src/web/pages/factory.astro and
// factory/agent.astro): the factory definition, read-only, with the link to the file and the branch in Git where it
// changes (CODE-002), in the shell of the new look. The template only reads it.
import type { ShellData } from "@opensoftware/ui";
import { stringify } from "yaml";
import type { Factory } from "../adapters/factory-file.ts";
import { linkOf } from "./runs.ts";

export interface Source {
  /** The file in the repository's web UI, when CONSOLE_REPOSITORY_URL is set. */
  url?: string;
  path: string;
  branch: string;
}

/** Where the definition changes: the branch, and the file, linked when it is an http or https URL. */
export interface Where {
  branch: string;
  file: ReturnType<typeof linkOf>;
}

export interface FactoryData {
  shell: ShellData;
  /** The factory's name and what it is for, as the definition says them. */
  name: string | undefined;
  description: string | undefined;
  where: Where;
  agents: { name: string; href: string; harness: string; model: string; effort: string }[];
  /** The providers as YAML. */
  providers: string;
}

export interface AgentData {
  shell: ShellData;
  name: string;
  where: Where;
  /** Each field of the agent: a value as text, a list or a map as YAML, on its own row. */
  fields: { key: string; text?: string; yaml?: string }[];
}

// Without CONSOLE_REPOSITORY_URL the file has no link: a dash, as before the new look.
const whereOf = (source: Source): Where => ({ branch: source.branch, file: linkOf(source.url, source.path) });

export const factoryData = (shell: ShellData, factory: Factory, source: Source): FactoryData => ({
  shell,
  name: factory.factory,
  description: factory.description,
  where: whereOf(source),
  agents: Object.entries(factory.agents ?? {}).map(([name, agent]) => ({
    name,
    href: `/factory/agents/${name}`,
    harness: String(agent.harness),
    model: String(agent.model),
    effort: String(agent.effort),
  })),
  providers: stringify(factory.providers ?? {}),
});

export const agentData = (
  shell: ShellData,
  name: string,
  agent: Record<string, unknown>,
  source: Source,
): AgentData => ({
  shell,
  name,
  where: whereOf(source),
  fields: Object.entries(agent).map(([key, value]) =>
    typeof value === "object" ? { key, yaml: stringify(value) } : { key, text: String(value) },
  ),
});
