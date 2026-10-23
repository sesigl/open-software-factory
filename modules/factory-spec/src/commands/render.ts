// "factory render": writes the harness files of one agent to the output folder.
import { join, normalize } from "node:path";
import { linkSkills, readText, writeFiles } from "../adapters/files.ts";
import { ghAwWorkflows } from "../domain/automations.ts";
import { fail } from "../domain/errors.ts";
import { kagentResources } from "../domain/kubernetes.ts";
import { servers } from "../domain/mcp.ts";
import { harness } from "../domain/render.ts";
import type { Factory } from "./load.ts";

export interface RenderOptions {
  agent?: string;
  /** A harness name, or "all" for every harness under providers.harness. Default: the agent's harness. */
  harness?: string;
  /** Also write the kagent resources and the agent's SandboxTemplate to k8s/<agent>.yaml. */
  k8s?: boolean;
  /** Also write a gh-aw workflow per automation GitHub starts. */
  ghAw?: boolean;
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
  const prompt = readText(join(factory.dir, agent.prompt));
  const files: Record<string, string> = { "AGENTS.md": prompt };
  for (const each of harnesses) Object.assign(files, harness(each).files(mcp));
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
  const written = writeFiles(output, files);
  const skills = (agent.skills ?? []).map((skill) => join(factory.dir, normalize(skill)));
  for (const each of harnesses) linkSkills(join(output, harness(each).skills), skills);
  return written;
}
