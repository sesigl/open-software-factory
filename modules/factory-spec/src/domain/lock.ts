// What factory.lock must pin for a factory.yaml, and what makes a lock stale, without asking a registry (T-58).
import type { FactoryDefinition } from "@opensoftware/contracts";
import { type Lock, missingEntry, parseReference } from "./mcp.ts";
import { remoteOf, unpinned } from "./skills.ts";

/** The ports whose adapters the foreman starts with npx when its maps do not name them (ADR 0110). */
export const PROGRAM_PORTS = ["harness", "sandbox", "forge", "inference"] as const;

/** The registry servers of every agent, each once. */
export function registryReferences(definition: FactoryDefinition): string[] {
  const references = Object.values(definition.agents).flatMap(
    ({ mcp }) => mcp?.filter((reference) => parseReference(reference).registry) ?? [],
  );
  return [...new Set(references)];
}

/** The entry of each skill of another repository that the agents use, by the skill's name (ADR 0146). */
export function remoteSkills(definition: FactoryDefinition): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const agent of Object.values(definition.agents))
    for (const entry of agent.skills ?? []) {
      const remote = remoteOf(entry);
      // Lint refuses a second skill of one name, so the first entry stands for it.
      if (remote) entries[remote.name] ??= entry;
    }
  return entries;
}

/**
 * One line per registry server and per skill of another repository that the lock does not pin, and, when the lock pins adapters, per adapter whose range
 * it does not pin. A pin that factory.yaml no longer uses does no harm and is not stale.
 */
export function staleLock(definition: FactoryDefinition, lock: Lock): string[] {
  const lines = registryReferences(definition)
    .filter((reference) => !lock.mcp[reference])
    .map(missingEntry);
  const { adapters } = lock;
  const { providers = {} } = definition;
  if (adapters)
    for (const port of PROGRAM_PORTS)
      for (const [name, range] of Object.entries(providers[port] ?? {}))
        if (adapters[port]?.[name]?.range !== range)
          lines.push(`factory.lock has no pin of the ${port} "${name}" for "${range}": run "factory plan --adapters"`);
  for (const [name, entry] of Object.entries(remoteSkills(definition)))
    if (lock.skills?.[name]?.source !== entry) lines.push(unpinned(name, entry));
  return lines;
}
