// "factory render": writes the harness files of one agent, the Kubernetes resources or the gh-aw workflows.
import { join, normalize } from "node:path";
import { stringify } from "yaml";
import { linkSkills, readText, writeFiles } from "../adapters/files.ts";
import { kubernetesSettings } from "../adapters/settings.ts";
import { fail } from "../domain/errors.ts";
import { workflowFile, workflows } from "../domain/ghaw.ts";
import { kubernetesResources } from "../domain/kubernetes.ts";
import { servers } from "../domain/mcp.ts";
import { harness } from "../domain/render.ts";
import type { Factory } from "./load.ts";

export interface RenderOptions {
  agent?: string;
  /** A harness name, or "all" for every harness under providers.harness. Default: the agent's harness. */
  harness?: string;
  /** Write the Kubernetes resources of every agent instead of harness files. */
  k8s?: boolean;
  /** Write the gh-aw workflows of the automations instead of harness files. */
  ghAw?: boolean;
}

/** Renders the files and links and returns the hash of every written file by its path below `output`. */
export function render(factory: Factory, output: string, options: RenderOptions): Record<string, string> {
  if (options.k8s) return writeFiles(output, kubernetes(factory));
  if (options.ghAw) return writeFiles(output, ghAw(factory));
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

function kubernetes(factory: Factory): Record<string, string> {
  const inputs = Object.fromEntries(
    Object.entries(factory.definition.agents).map(([name, agent]) => [
      name,
      { prompt: readText(join(factory.dir, agent.prompt)), servers: servers(agent.mcp ?? [], factory.lock) },
    ]),
  );
  const resources = kubernetesResources(factory.definition, inputs, kubernetesSettings());
  return Object.fromEntries(
    Object.entries(resources).map(([path, resource]) => [
      path,
      `# Written by "factory render --k8s" from factory.yaml. Do not edit.\n${stringify(resource, { lineWidth: 0, aliasDuplicateObjects: false })}`,
    ]),
  );
}

function ghAw(factory: Factory): Record<string, string> {
  return Object.fromEntries(
    workflows(factory.definition).map((workflow) => {
      const agent =
        factory.definition.agents[workflow.agent] ?? fail(`factory.yaml declares no agent "${workflow.agent}"`);
      const prompt = readText(join(factory.dir, agent.prompt));
      const text = workflowFile(workflow, agent.harness, prompt, servers(agent.mcp ?? [], factory.lock));
      return [`.github/workflows/${workflow.name}.md`, text];
    }),
  );
}
