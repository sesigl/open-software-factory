// The webhooks a factory needs (ADR 0022): one per repository of the factory, for the Forgejo events of its
// automations that start with "forgejo.".
import type { FactoryDefinition } from "@opensoftware/contracts";
import { forgejoEvent, parseFilter } from "./events.ts";

/** A webhook as the forge reports it; apply records it and plan compares with it. */
export interface Hook {
  id: number;
  url: string;
  events: string[];
  active: boolean;
}

/** The Forgejo events by repository ("owner/name"); empty when no automation starts with "forgejo.". */
export function wantedHooks(definition: FactoryDefinition): Record<string, string[]> {
  const filters = (definition.automations ?? [])
    .map((automation) => automation.on)
    .filter((filter): filter is string => filter !== undefined && parseFilter(filter).source === "forgejo");
  const events = [...new Set(filters.map(forgejoEvent))].sort();
  if (events.length === 0) return {};
  const repositories = new Set(Object.values(definition.agents).flatMap((agent) => agent.repositories ?? []));
  return Object.fromEntries([...repositories].sort().map((repository) => [repository, events]));
}

/** The drift line of a recorded webhook, or nothing when the forge still has it as recorded. */
export function hookDrift(repository: string, recorded: Hook, now: Hook | undefined): string[] {
  if (!now) return [`! webhook of ${repository} was deleted outside "factory apply"`];
  const same = JSON.stringify(normal(recorded)) === JSON.stringify(normal(now));
  return same ? [] : [`! webhook of ${repository} changed outside "factory apply"`];
}

function normal(hook: Hook): Hook {
  return { id: hook.id, url: hook.url, events: [...hook.events].sort(), active: hook.active };
}
