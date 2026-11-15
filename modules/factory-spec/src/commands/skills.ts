// factory skills: every skill the factory's agents use, as one JSON document for a program like the console (ADR 0135,
// ADR 0140). It reads the skills with the rules of lint and prints a skill that lint refuses with its problems; only a
// factory.yaml that does not fit the contract fails.
import { join } from "node:path";
import { filesBelow } from "../adapters/files.ts";
import { FactoryError } from "../domain/errors.ts";
import { type CatalogSkill, skillCatalog } from "../domain/skills.ts";
import { lintFile } from "./load.ts";

export function skills(file: string): { skills: CatalogSkill[] } {
  const { dir, fits, problems } = lintFile(file);
  if (!fits) throw new FactoryError(problems.join("\n"));
  return { skills: skillCatalog(fits, (path) => filesBelow(join(dir, path))) };
}
