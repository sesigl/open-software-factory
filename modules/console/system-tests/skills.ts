// Shared setup of the skills scenarios (ADR 0141): the console runs factory-spec's "factory skills" in
// CONSOLE_FACTORY_COMMAND. ISOLATION keeps its tests from starting another module, so a small program in $INPUT stands
// in for it: it prints the JSON that factory-spec's scenarios SCN-FSPEC-115 to 118 prove, and records its arguments.
// That JSON must fit the format skill-catalog of the contracts (ADR 0143), so the two modules cannot drift apart.
import { type CatalogSkill, type SkillCatalog, validate } from "@opensoftware/contracts";
import type { Fakes, Page, Sut } from "@opensoftware/testkit";
import { foreman, serving } from "./console.ts";
import { type AgentOf, factoryOf, type Store, servingSecrets } from "./secrets.ts";

/**
 * The skill of this name in the folder skills/<name>, used by these agents with what each gives and lacks; `fields`
 * replaces the rest.
 */
export function skillOf(
  name: string,
  agents: Record<string, { secrets?: Record<string, string>; lacks?: { secrets?: string[]; hosts?: string[] } }>,
  fields: Partial<CatalogSkill> = {},
): CatalogSkill {
  return {
    name,
    description: `The skill ${name}. Use it in the scenarios of the console.`,
    source: { folder: `skills/${name}` },
    needs: { secrets: [], hosts: [] },
    agents: Object.entries(agents).map(([agent, { secrets = {}, lacks = {} }]) => ({
      name: agent,
      secrets,
      lacks: { secrets: lacks.secrets ?? [], hosts: lacks.hosts ?? [] },
    })),
    files: ["SKILL.md"],
    body: `\n# ${name}\n`,
    problems: [],
    ...fields,
  };
}

/** A shell word in single quotes. */
export const word = (text: string): string => `'${text.replaceAll("'", `'\\''`)}'`;

/** Writes these skills to $INPUT/skills.json, which must fit the format skill-catalog; gives the shell line that prints it. */
export async function catalogOf(sut: Sut, skills: CatalogSkill[]): Promise<string> {
  const catalog: SkillCatalog = { skills };
  expect(validate("skill-catalog", catalog), "the stand-in's JSON fits the format skill-catalog").toEqual([]);
  await sut.files.put("$INPUT/skills.json", JSON.stringify(catalog, null, 2));
  return `cat ${word(sut.files.path("$INPUT/skills.json"))}`;
}

/**
 * Writes the factory program: it records its arguments in $OUTPUT/factory.log and prints these skills, which must fit
 * the format skill-catalog, or fails with this error and exit code 1. Returns its command line for
 * CONSOLE_FACTORY_COMMAND.
 */
export async function factoryProgram(sut: Sut, answer: CatalogSkill[] | { error: string }): Promise<string> {
  const log = word(sut.files.path("$OUTPUT/factory.log"));
  const print = Array.isArray(answer) ? [await catalogOf(sut, answer)] : [`echo ${word(answer.error)} >&2`, "exit 1"];
  await sut.files.put("$INPUT/bin/factory", ["#!/bin/sh", `echo "$@" > ${log}`, ...print, ""].join("\n"), {
    executable: true,
  });
  return sut.files.path("$INPUT/bin/factory");
}

/** Starts a console behind a sign-in proxy with ada@acme.dev as admin, these agents, the store and these skills. */
export async function servingSkills(
  sut: Sut,
  fakes: Fakes,
  agents: Record<string, AgentOf>,
  skills: CatalogSkill[],
  env: Record<string, string> = {},
): Promise<Store> {
  const command = await factoryProgram(sut, skills);
  return servingSecrets(sut, fakes, agents, { env: { CONSOLE_FACTORY_COMMAND: command, ...env } });
}

/** Starts a console in the open mode, without a store, with these agents and the factory program's answer. */
export async function servingOpen(
  sut: Sut,
  fakes: Fakes,
  agents: Record<string, AgentOf>,
  answer: CatalogSkill[] | { error: string },
): Promise<void> {
  const command = await factoryProgram(sut, answer);
  const api = await foreman(fakes, []);
  await serving(sut, [api.url], { ...(await factoryOf(sut, agents)), CONSOLE_FACTORY_COMMAND: command });
}

/** A skill with this SKILL.md body only, for the Markdown scenarios, in a console in the open mode. */
export async function servingBody(sut: Sut, fakes: Fakes, body: string): Promise<void> {
  await servingOpen(sut, fakes, { triage: {} }, [skillOf("release-notes", { triage: {} }, { body })]);
}

/** The text of each row of the list "Skills", by the skill's name. */
export function skillRows(page: Page): Record<string, string> {
  const items = page.queryByRole("list", { name: "Skills" })?.queryAllByRole("listitem") ?? [];
  return Object.fromEntries(
    items.flatMap((item) => {
      const link = item.queryAllByRole("link")[0];
      return link && item.text.startsWith(link.text) ? [[link.text, item.text]] : [];
    }),
  );
}

/** The texts of the items of the list of what a skill needs on "/skills". */
export const needsOf = (page: Page, skill: string): string[] =>
  page
    .getByRole("list", { name: `What ${skill} needs` })
    .queryAllByRole("listitem")
    .map((item) => item.text);

/** The panel "SKILL.md" of a skill's page. */
export const skillMd = (page: Page) => page.getByRole("region", { name: "SKILL.md" });
