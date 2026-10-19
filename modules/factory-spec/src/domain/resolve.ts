// The resolved definition: defaults filled in and registry servers pinned. It is still a valid factory-definition.
import type { FactoryDefinition } from "@opensoftware/contracts";
import { type Lock, pinned } from "./mcp.ts";

export function resolveDefinition(definition: FactoryDefinition, lock: Lock): FactoryDefinition {
  const agents = Object.fromEntries(
    Object.entries(definition.agents).map(([name, agent]) => [
      name,
      agent.mcp ? { ...agent, mcp: agent.mcp.map((reference) => pinned(lock, reference)) } : agent,
    ]),
  );
  const resolved: FactoryDefinition = { ...definition, agents };
  if (definition.workflow)
    resolved.workflow = definition.workflow.map((stage) => ({ ...stage, agent: stage.agent ?? stage.stage }));
  if (definition.scorers) {
    resolved.scorers = Object.fromEntries(
      Object.entries(definition.scorers).map(([name, scorer]) => [name, { ...scorer, sample: scorer.sample ?? 1 }]),
    );
  }
  return resolved;
}
