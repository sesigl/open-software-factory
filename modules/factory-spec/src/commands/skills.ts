// factory skills: every skill the factory's agents use, as one document of the format skill-catalog of the contracts,
// for a program like the console (ADR 0135, ADR 0140, ADR 0143). It reads the skills with the rules of lint and prints
// a skill that lint refuses with its problems; only a factory.yaml that does not fit the contract fails.
// A skill of another repository is read from its folder fetched at the pin of factory.lock, with that commit; one
// without a pin is printed with its problem (ADR 0146).
import { dirname, join, resolve } from "node:path";
import type { SkillCatalog } from "@opensoftware/contracts";
import { filesBelow, readLock } from "../adapters/files.ts";
import { FactoryError } from "../domain/errors.ts";
import { remoteOf, skillCatalog } from "../domain/skills.ts";
import { lintFile } from "./load.ts";
import { pinnedFolders } from "./pins.ts";

export async function skills(file: string): Promise<SkillCatalog> {
  const { dir, fits, problems } = lintFile(file);
  if (!fits) throw new FactoryError(problems.join("\n"));
  const lock = readLock(dirname(resolve(file)));
  const fetched = await pinnedFolders(fits, lock);
  const commits = Object.fromEntries(Object.values(lock.skills ?? {}).map((pin) => [pin.source, pin.commit] as const));
  const files = (entry: string) => {
    const folder = fetched[entry];
    if (folder) return filesBelow(folder);
    return remoteOf(entry) ? undefined : filesBelow(join(dir, entry));
  };
  return { skills: skillCatalog(fits, files, commits) };
}
