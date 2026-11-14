// The rules of the skills an agent uses (ADR 0140): a folder with a SKILL.md in the Agent Skills format
// (agentskills.io), files the foreman can copy as text (ADR 0112), one skill per name, and the secrets and hosts a
// skill needs, which its agent declares.
import type { FactoryDefinition } from "@opensoftware/contracts";
import { type Document, isMap, LineCounter, parseDocument } from "yaml";
import { locate, type Place } from "./locate.ts";

/** The keys of `metadata` that name what a skill needs: one text of names, separated by spaces. */
export const NEEDS = { secrets: "opensoftware/secrets", hosts: "opensoftware/hosts" } as const;

/** A finding in a skill's file, by its path relative to the factory's folder. */
export interface FileFinding extends Place {
  file: string;
  message: string;
}

/** A finding in factory.yaml at the path of its node. */
export type Finding = [path: string[], message: string];

export interface SkillFindings {
  findings: Finding[];
  problems: FileFinding[];
  warnings: FileFinding[];
}

/** The files below a folder relative to the factory's folder, by their path below it; none for a missing folder. */
export type FolderFiles = (folder: string) => Record<string, Uint8Array>;

type Needs = Record<keyof typeof NEEDS, string[]>;
type Agent = FactoryDefinition["agents"][string];

/** The needs of a skill whose SKILL.md cannot be read: its problems say so already. */
const NONE: Needs = { secrets: [], hosts: [] };

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FORMS = {
  secrets: [/^[A-Z0-9_]+$/, 'variable of upper-case letters, digits and "_"'],
  hosts: [/^[a-z0-9-]+(\.[a-z0-9-]+)*$/, "host name"],
} as const;

/** The findings of every skill the agents use. */
export function skillRules(definition: FactoryDefinition, files: FolderFiles): SkillFindings {
  const result: SkillFindings = { findings: [], problems: [], warnings: [] };
  // Each skill by its name, the last segment of its folder, which names it in a session and in render's links.
  const skills = new Map<string, { folder: string; path: string; needs: Needs }>();
  for (const [name, agent] of Object.entries(definition.agents))
    for (const [index, path] of (agent.skills ?? []).entries()) {
      const at = ["agents", name, "skills", String(index)];
      const folder = path
        .split("/")
        .filter((part) => part && part !== ".")
        .join("/");
      const skill = folder.split("/").pop() as string;
      const known = skills.get(skill) ?? { folder, path, needs: checked(path, folder, files(path), result, at) };
      skills.set(skill, known);
      if (known.folder !== folder) {
        const message = `the skill "${path}" has the name "${skill}" of the skill "${known.path}": a factory uses one skill of a name`;
        result.findings.push([at, message]);
      } else for (const message of lacks(name, agent, skill, known.needs)) result.findings.push([at, message]);
    }
  return result;
}

/** What the agent lacks of the skill's needs; an agent without a sandbox reaches every host. */
function lacks(name: string, agent: Agent, skill: string, needs: Needs): string[] {
  const variables = new Set(agent.secrets?.map(variable));
  const egress = new Set(agent.sandbox?.egress);
  return [
    ...needs.secrets
      .filter((secret) => !variables.has(secret))
      .map(
        (secret) =>
          `agent "${name}" lacks the secret ${secret} that its skill "${skill}" needs: add a reference such as "ref:<provider>/${secret.toLowerCase().replaceAll("_", "-")}" to agents.${name}.secrets`,
      ),
    ...(agent.sandbox ? needs.hosts : [])
      .filter((host) => !egress.has(host))
      .map(
        (host) =>
          `agent "${name}" lacks the host "${host}" that its skill "${skill}" needs: add it to agents.${name}.sandbox.egress`,
      ),
  ];
}

/** The variable that holds a secret reference in a sandbox, as the foreman names it (ADR 0068). */
const variable = (reference: string): string =>
  reference
    .slice(reference.indexOf("/") + 1)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_");

/** Checks the files of one skill folder and returns its needs; a folder without SKILL.md is a finding at `at`. */
function checked(
  path: string,
  folder: string,
  files: Record<string, Uint8Array>,
  result: SkillFindings,
  at: string[],
): Needs {
  const texts: Record<string, string> = {};
  for (const [file, bytes] of Object.entries(files)) {
    try {
      texts[file] = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      const message =
        "the file is not UTF-8 text: the foreman copies a skill's files as text, so keep binary files out of the skill";
      result.problems.push({ file: `${folder}/${file}`, line: 1, column: 1, message });
    }
  }
  const text = texts["SKILL.md"];
  if (text !== undefined) return frontMatter(folder, text, result);
  if (!files["SKILL.md"]) result.findings.push([at, `the skill "${path}" has no SKILL.md`]);
  return NONE;
}

/** The rules of the format for SKILL.md and its front matter; returns the needs it names. */
function frontMatter(folder: string, text: string, result: SkillFindings): Needs {
  const file = `${folder}/SKILL.md`;
  const lines = text.replace(/\n$/, "").split("\n");
  if (lines.length >= 500) {
    const message = `warning: SKILL.md has ${lines.length} lines; the format asks for fewer than 500, with the details in files beside it`;
    result.warnings.push({ file, line: 1, column: 1, message });
  }
  const end = lines.indexOf("---", 1);
  if (lines[0] !== "---" || end < 0) {
    const message =
      'SKILL.md has no front matter: it starts with a line "---", the fields name and description and a line "---"';
    result.problems.push({ file, line: 1, column: 1, message });
    return NONE;
  }
  const counter = new LineCounter();
  const document = parseDocument(lines.slice(1, end).join("\n"), { lineCounter: counter, prettyErrors: false });
  // The front matter starts on the second line of SKILL.md.
  const at = ({ line, column }: Place, message: string) =>
    void result.problems.push({ file, line: line + 1, column, message });
  const problem = (path: string[], message: string) => at(locate(document, counter, path), message);
  for (const error of document.errors) {
    const { line, col } = counter.linePos(error.pos[0]);
    at({ line, column: col }, error.message.split("\n")[0] as string);
  }
  if (document.errors.length > 0) return NONE;
  const fields = (isMap(document.contents) ? document.toJS() : {}) as Record<string, unknown>;
  const skill = folder.split("/").pop() as string;
  const { name, description, compatibility } = fields;
  // A missing field has no place of its own: its finding names the front matter's first line.
  const first = { line: 1, column: 1 };
  if (name === undefined) at(first, `the skill has no name: write "name: ${skill}", the name of its folder`);
  else if (!NAME.test(String(name)))
    problem(["name"], `name "${name}" is not lowercase letters and digits with single hyphens between them`);
  else if (name !== skill) problem(["name"], `name "${name}" is not "${skill}", the name of its folder`);
  if (!description) at(first, "the skill has no description: say what it does and when to use it");
  for (const [field, value, max] of [
    ["name", name, 64],
    ["description", description, 1024],
    ["compatibility", compatibility, 500],
  ] as const) {
    const length = typeof value === "string" ? [...value].length : 0;
    if (length > max) problem([field], `${field} has ${length} characters, more than the ${max} the format allows`);
  }
  return needsOf(document, fields.metadata as Record<string, unknown>, problem);
}

/** The needs that metadata names: each key's text, split at spaces, with the names that fit their form. */
function needsOf(
  document: Document,
  metadata: Record<string, unknown> | undefined,
  problem: (path: string[], message: string) => void,
): Needs {
  const needs: Needs = { secrets: [], hosts: [] };
  if (metadata === undefined) return needs;
  if (!isMap(document.get("metadata"))) {
    problem(["metadata"], "metadata is no mapping of keys to text");
    return needs;
  }
  for (const kind of ["secrets", "hosts"] as const) {
    const key = NEEDS[kind];
    const names = metadata[key];
    if (names === undefined) continue;
    if (typeof names !== "string") {
      problem(["metadata", key], `metadata "${key}" is no text: write the names on one line, separated by spaces`);
      continue;
    }
    const [form, what] = FORMS[kind];
    for (const each of names.split(" "))
      if (form.test(each)) needs[kind].push(each);
      else problem(["metadata", key], `metadata "${key}" names "${each}", which is no ${what}`);
  }
  return needs;
}
