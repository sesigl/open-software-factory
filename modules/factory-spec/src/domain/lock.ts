// What factory.lock must pin for a factory.yaml, and what makes a lock stale, without asking a registry (T-58).
import type { FactoryDefinition } from "@opensoftware/contracts";
import { type Lock, missingEntry, parseReference } from "./mcp.ts";

/** The ports whose adapters the foreman starts with npx when its maps do not name them (ADR 0110). */
export const PROGRAM_PORTS = ["harness", "sandbox", "forge", "inference"] as const;

/** The registry servers of every agent, each once. */
export function registryReferences(definition: FactoryDefinition): string[] {
  const references = Object.values(definition.agents).flatMap(
    ({ mcp }) => mcp?.filter((reference) => parseReference(reference).registry) ?? [],
  );
  return [...new Set(references)];
}

/**
 * One line per registry server that the lock does not pin, and, when the lock pins adapters, per adapter whose range
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
  return lines;
}
