// "factory render": writes the harness files of one agent to the output folder.
import { join, normalize } from "node:path";
import { linkSkills, readText, writeFiles } from "../adapters/files.ts";
import { fail } from "../domain/errors.ts";
import { servers } from "../domain/mcp.ts";
import { harness } from "../domain/render.ts";
import type { Factory } from "./load.ts";

export interface RenderOptions {
  agent?: string;
  /** A harness name, or "all" for every harness under providers.harness. Default: the agent's harness. */
  harness?: string;
}

/** Renders the files and links and returns the hash of every written file by its path below `output`. */
export function render(factory: Factory, output: string, options: RenderOptions): Record<string, string> {
  const names = Object.keys(factory.definition.agents);
  const name =
    options.agent ??
    (names.length === 1 ? names[0] : undefined) ??
    fail(`factory.yaml declares ${names.length} agents: choose one with --agent ${names.join("|")}`);
  const agent = factory.definition.agents[name] ?? fail(`factory.yaml declares no agent "${name}"`);
  const harnesses =
    options.harness === "all"
      ? Object.keys(factory.definition.providers?.harness ?? {})
      : [options.harness ?? agent.harness];
  const mcp = servers(agent.mcp ?? [], factory.lock);
  const files: Record<string, string> = { "AGENTS.md": readText(join(factory.dir, agent.prompt)) };
  for (const each of harnesses) Object.assign(files, harness(each).files(mcp));
  const written = writeFiles(output, files);
  const skills = (agent.skills ?? []).map((skill) => join(factory.dir, normalize(skill)));
  for (const each of harnesses) linkSkills(join(output, harness(each).skills), skills);
  return written;
}
