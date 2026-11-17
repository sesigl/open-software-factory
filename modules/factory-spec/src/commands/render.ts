// "factory render": writes the harness files of one agent to the output folder.
import { join, normalize } from "node:path";
import { exists, linkSkills, readText, writeFiles } from "../adapters/files.ts";
import { ghAwWorkflows } from "../domain/automations.ts";
import { fail } from "../domain/errors.ts";
import { kagentResources } from "../domain/kubernetes.ts";
import { servers } from "../domain/mcp.ts";
import { harness } from "../domain/render.ts";
import { remoteOf, unpinned } from "../domain/skills.ts";
import type { Factory } from "./load.ts";
import { pinnedFolders } from "./pins.ts";

export interface RenderOptions {
  agent?: string;
  /** A harness name, or "all" for every harness under providers.harness. Default: the agent's harness. */
  harness?: string;
  /** Also write the kagent resources and the agent's SandboxTemplate to k8s/<agent>.yaml. */
  k8s?: boolean;
  /** Also write a gh-aw workflow per automation GitHub starts. */
  ghAw?: boolean;
}

export interface Rendered {
  /** The hash of every written file, by its path below the output folder. */
  files: Record<string, string>;
  /** A line for each harness that runs no stop check of the agent (ADR 0168). */
  notes: string[];
}

/**
 * Renders the files and links. A skill of another repository is linked from the cache, fetched at its pin (ADR 0146).
 */
export async function render(factory: Factory, output: string, options: RenderOptions): Promise<Rendered> {
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
  const prompt = readText(join(factory.dir, agent.prompt));
  const files: Record<string, string> = { "AGENTS.md": prompt };
  for (const each of harnesses) Object.assign(files, harness(each).files(mcp));
  const notes: string[] = [];
  const command = agent.stopCheck?.command;
  for (const each of command === undefined ? [] : harnesses) {
    const stop = harness(each).stopCheck;
    if (!stop) notes.push(`${each} runs no stop check, so factory render writes none for it`);
    else {
      const path = join(output, stop.path);
      files[stop.path] = stop.write(exists(path) ? readText(path) : undefined, command as string);
    }
  }
  const { definition } = factory;
  if (options.ghAw) Object.assign(files, ghAwWorkflows(definition, agent.harness, prompt, mcp));
  if (options.k8s) {
    const inference = process.env.FACTORY_INFERENCE_URL ?? "http://litellm:4000/v1";
    const { sandbox } = agent;
    const input = {
      factory: definition.factory,
      agent: name,
      model: agent.model,
      prompt,
      servers: mcp,
      inference,
      sandbox,
    };
    files[`k8s/${name}.yaml`] = kagentResources(input);
  }
  const fetched = await pinnedFolders(definition, factory.lock);
  const written = writeFiles(output, files);
  const skills = (agent.skills ?? []).map((skill) => {
    const remote = remoteOf(skill);
    if (!remote) return join(factory.dir, normalize(skill));
    return fetched[skill] ?? fail(unpinned(remote.name, skill));
  });
  for (const each of harnesses) linkSkills(join(output, harness(each).skills), skills);
  return { files: written, notes };
}
