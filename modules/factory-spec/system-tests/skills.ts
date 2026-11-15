// The skills of the skill scenarios: a SKILL.md from its front matter, and a factory whose agent "triage" uses skills.
import type { CliResult, Sut } from "@opensoftware/testkit";
import { putTriage } from "./edit.ts";

/** A SKILL.md with the front matter lines between its two lines "---", then the body. */
export const skillMd = (front: string[], body = "# Release notes\n"): string =>
  ["---", ...front, "---", "", body].join("\n");

/** The skill "release-notes" of the vision's example: it needs the secret LINEAR_TOKEN and the host api.linear.app. */
export const RELEASE_NOTES = skillMd([
  "name: release-notes",
  "description: Write the release notes of a change from its Linear issues. Use when a change ships.",
  "metadata:",
  "  opensoftware/secrets: LINEAR_TOKEN",
  "  opensoftware/hosts: api.linear.app",
]);

/** A valid SKILL.md for the folder name. */
export const named = (name: string): string =>
  skillMd([`name: ${name}`, `description: The skill ${name}. Use it in the scenarios of factory-spec.`]);

export const putSkill = (sut: Sut, folder: string, text: string | Uint8Array, file = "SKILL.md"): Promise<void> =>
  sut.files.put(`$INPUT/${folder}/${file}`, text);

/** The secrets providers "env" and "openbao" beside the harness "claude-code". */
export const SECRETS = ["harness:", '  claude-code: "^2"', "secrets:", '  env: "^0"', '  openbao: "^0"'];

/**
 * The agent "triage" with the skills on one line (line 13 with SECRETS), then the extra lines; returns the text of
 * factory.yaml.
 */
export const putSkilled = (sut: Sut, skills: string[], extra: string[] = []): Promise<string> =>
  putTriage(sut, [`skills: [${skills.join(", ")}]`, ...extra], SECRETS);

/** What "factory skills" prints (README.md#the-skills-as-json). */
export interface Catalog {
  skills: {
    name: string;
    description: string | null;
    source: { folder: string };
    needs: { secrets: string[]; hosts: string[] };
    agents: { name: string; secrets: Record<string, string>; lacks: { secrets: string[]; hosts: string[] } }[];
    files: string[];
    body: string | null;
    problems: string[];
  }[];
}

/** The lines that "factory lint" printed. */
export function lines(run: CliResult): string[] {
  return run.stdout.split("\n").filter(Boolean);
}
