// The skills of other Git repositories in factory.lock (ADR 0146): pinned by "factory plan", fetched at their pins by
// "factory render" and "factory skills".
import type { FactoryDefinition } from "@opensoftware/contracts";
import { fetchSkill } from "../adapters/skills.ts";
import { remoteSkills } from "../domain/lock.ts";
import type { Lock, SkillPin } from "../domain/mcp.ts";

/** The folder of each skill of another repository that factory.lock pins for its entry, by the entry. */
export async function pinnedFolders(definition: FactoryDefinition, lock: Lock): Promise<Record<string, string>> {
  const folders: Record<string, string> = {};
  for (const [name, entry] of Object.entries(remoteSkills(definition))) {
    const pin = lock.skills?.[name];
    if (pin?.source === entry) folders[entry] = (await fetchSkill(entry, pin)).folder;
  }
  return folders;
}

/**
 * The pin of every skill of another repository: kept while its entry is unchanged, else the commit of the entry's ref
 * now; and the folder of each, fetched at its pin, by the entry.
 */
export async function pinSkills(
  definition: FactoryDefinition,
  lock: Lock,
): Promise<{ pins: Record<string, SkillPin>; folders: Record<string, string> }> {
  const pins: Record<string, SkillPin> = {};
  const folders: Record<string, string> = {};
  for (const [name, entry] of Object.entries(remoteSkills(definition))) {
    const kept = lock.skills?.[name];
    const fetched = await fetchSkill(entry, kept?.source === entry ? kept : undefined);
    pins[name] = { source: entry, commit: fetched.commit, hash: fetched.hash };
    folders[entry] = fetched.folder;
  }
  return { pins, folders };
}
