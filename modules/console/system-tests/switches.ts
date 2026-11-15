// Shared setup of the switches of a skill (ADR 0149): the console behind a sign-in proxy with the people of the
// changes, a factory whose agent "triage" uses the skill "release-notes", and a stand-in of factory-spec's "factory",
// since ISOLATION keeps the console's tests from starting another module. The stand-in prints the skills for
// "factory skills" and, for "factory edit", the file it is given with the line "# <edit> <agent> <value>" added, so
// that a change of several edits shows each edit in its order; it records its arguments.
import type { CatalogSkill } from "@opensoftware/contracts";
import type { Fakes, Page, Sut } from "@opensoftware/testkit";
import { ENGINEER, PEOPLE } from "./changes.ts";
import { foreman, serving } from "./console.ts";
import { type AgentOf, factoryYaml } from "./secrets.ts";
import { accessYaml } from "./signin.ts";
import { catalogOf, skillOf, word } from "./skills.ts";

/** The skill "release-notes" that "triage" uses: it needs the secret LINEAR_TOKEN and the host api.linear.app. */
export const RELEASE_NOTES = skillOf(
  "release-notes",
  { triage: { secrets: { LINEAR_TOKEN: "ref:env/LINEAR_TOKEN" } } },
  { needs: { secrets: ["LINEAR_TOKEN"], hosts: ["api.linear.app"] } },
);

/**
 * The agents of the factory: "triage" uses "./skills/release-notes" with what it needs from the provider "env";
 * "review" has a sandbox that reaches "api.github.com" only and declares no secret.
 */
export const AGENTS: Record<string, AgentOf> = {
  review: { egress: ["api.github.com"] },
  triage: {
    skills: ["./skills/release-notes"],
    secrets: ["ref:env/LINEAR_TOKEN"],
    egress: ["api.github.com", "api.linear.app"],
  },
};

/** The stand-in of the factory program for these skills. Returns its command line for CONSOLE_FACTORY_COMMAND. */
export async function switchProgram(sut: Sut, skills: CatalogSkill[]): Promise<string> {
  const log = word(sut.files.path("$OUTPUT/factory.log"));
  const script = [
    "#!/bin/sh",
    `echo "$@" >> ${log}`,
    `if [ "$1" = skills ]; then ${await catalogOf(sut, skills)}; exit 0; fi`,
    // factory edit --file <file> <edit> -- <agent> <value>
    'cat "$3"',
    'echo "# $4 $6 $7"',
    "",
  ].join("\n");
  await sut.files.put("$INPUT/bin/factory", script, { executable: true });
  return sut.files.path("$INPUT/bin/factory");
}

/**
 * Starts a console behind a sign-in proxy with the people of the changes, the factory with these agents and the
 * secrets provider "env", the stand-in for these skills, and these variables.
 */
export async function servingSwitches(
  sut: Sut,
  fakes: Fakes,
  env: Record<string, string>,
  agents: Record<string, AgentOf> = AGENTS,
  skills: CatalogSkill[] = [RELEASE_NOTES],
): Promise<void> {
  await sut.files.put("$INPUT/access.yaml", accessYaml(PEOPLE));
  await sut.files.put("$INPUT/factory.yaml", factoryYaml(agents, "env"));
  const api = await foreman(fakes, []);
  await serving(sut, [api.url], {
    CONSOLE_FACTORY: sut.files.path("$INPUT/factory.yaml"),
    CONSOLE_USER_HEADER: "X-Forwarded-Email",
    CONSOLE_FACTORY_COMMAND: await switchProgram(sut, skills),
    ...env,
  });
}

/** "/skills/release-notes" as the person of the headers opens it. */
export const openSkill = (sut: Sut, headers = ENGINEER): Promise<Page> =>
  sut.pages.open("/skills/release-notes", { headers });

/** The text of each item of the list "Agents" of a skill's page. */
export const agentTexts = (page: Page): string[] =>
  page
    .getByRole("list", { name: "Agents" })
    .queryAllByRole("listitem")
    .map((item) => item.text);

/** The texts of the list "What the change does" of the page that asks first. */
export const editTexts = (page: Page): string[] =>
  page
    .getByRole("list", { name: "What the change does" })
    .queryAllByRole("listitem")
    .map((item) => item.text);
