// `make agents-sync`: links every skill in skills/ into the skill folder of each harness, so every harness
// reads the same skills. Links are relative and committed; stale links into skills/ are removed.
import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

/** Skill folders of the harnesses: Claude Code, Codex and other Agent Skills readers, OpenCode. */
export const HARNESS_SKILL_DIRS = [".claude/skills", ".agents/skills", ".opencode/skills"];

export function agentsSync(root: string): number {
  const skillsDir = join(root, "skills");
  const skills = existsSync(skillsDir)
    ? readdirSync(skillsDir)
        .filter((name) => existsSync(join(skillsDir, name, "SKILL.md")))
        .sort()
    : [];
  for (const dir of HARNESS_SKILL_DIRS) {
    const target = join(root, dir);
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(target)) {
      const link = join(target, entry);
      if (
        lstatSync(link).isSymbolicLink() &&
        readlinkSync(link).startsWith("../../skills/") &&
        !skills.includes(entry)
      ) {
        rmSync(link);
      }
    }
    for (const skill of skills) {
      const link = join(target, skill);
      const wanted = `../../skills/${skill}`;
      if (existsSync(link) || isLink(link)) {
        if (isLink(link) && readlinkSync(link) === wanted) continue;
        rmSync(link, { recursive: true, force: true });
      }
      symlinkSync(wanted, link);
    }
  }
  process.stdout.write(`Linked ${skills.length} skills into ${HARNESS_SKILL_DIRS.join(", ")}\n`);
  return 0;
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
