// factory skills: every skill the factory's agents use, as one document of the format skill-catalog of the contracts,
// for a program like the console (ADR 0135, ADR 0140, ADR 0143). It reads the skills with the rules of lint and prints
// a skill that lint refuses with its problems; only a factory.yaml that does not fit the contract fails.
import { join } from "node:path";
import type { SkillCatalog } from "@opensoftware/contracts";
import { filesBelow } from "../adapters/files.ts";
import { FactoryError } from "../domain/errors.ts";
import { skillCatalog } from "../domain/skills.ts";
import { lintFile } from "./load.ts";

export function skills(file: string): SkillCatalog {
  const { dir, fits, problems } = lintFile(file);
  if (!fits) throw new FactoryError(problems.join("\n"));
  return { skills: skillCatalog(fits, (path) => filesBelow(join(dir, path))) };
}
