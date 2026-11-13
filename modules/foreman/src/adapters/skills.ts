// The agent's skills in the session's folder (ADR 0112): each skill's files below every folder of SKILL_FOLDERS,
// before the folder is copied into a sandbox. A skill replaces the folder of the same name; others stay.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SKILL_FOLDERS, type Skill } from "../domain/tools.ts";

export function writeSkills(folder: string, skills: Skill[]): void {
  for (const parent of SKILL_FOLDERS)
    for (const skill of skills) {
      const root = join(folder, parent, skill.name);
      rmSync(root, { recursive: true, force: true });
      for (const [path, text] of Object.entries(skill.files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
      }
    }
}
