// The data of the page "/skills" (src/web/pages/skills.astro) and of a skill's page "/skills/<name>"
// (src/web/pages/skills/skill.astro), in the shell of the new look (ADR 0133, ADR 0141). The skill's Markdown comes
// here as safe HTML; every other value is text that the template escapes.
import type { ShellData } from "@opensoftware/ui";
import { htmlOf } from "../domain/markdown.ts";
import { agentsText, type State } from "../domain/secrets.ts";
import type { Need, NeedState, Skill } from "../domain/skills.ts";
import { LOOKS } from "./secrets.ts";

export interface NeedRow {
  /** "Secret" or "Host". */
  kind: string;
  name: string;
  /** The references that give a secret, and the agents that lack it. */
  detail: string | undefined;
  /** The state as a word, like "Missing", and the classes of its shape and colour. */
  state: string | undefined;
  stateClass: string | undefined;
  /** "Store a value" for a missing secret, for a person who may open "/secrets". */
  action?: { href: string; text: string };
}

export interface SkillRow {
  name: string;
  href: string;
  description: string;
  /** Where it comes from and the agents that use it. */
  detail: string;
  /** The name of the list of its needs, like "What release-notes needs", or undefined when it needs nothing. */
  needsLabel: string | undefined;
  needs: NeedRow[];
  /** "Fails factory lint" when lint names a problem in its files. */
  problems: string | undefined;
}

export interface SkillsData {
  shell: ShellData;
  /** What failed, like a factory program that did not answer. */
  notes: string[];
  rows: SkillRow[];
  empty: boolean;
}

export interface SkillData {
  shell: ShellData;
  notes: string[];
  name: string;
  description: string;
  source: string;
  problems: string[];
  agents: { name: string; detail: string }[];
  /** The name of the list of what it needs, or undefined when it needs nothing. */
  needsLabel: string | undefined;
  needs: NeedRow[];
  files: string[];
  /** Whether the folder has a SKILL.md that the page can show. */
  shown: boolean;
  /** The Markdown of SKILL.md below its front matter as safe HTML. */
  html: string;
}

const LACKS: Record<"not declared" | "not allowed", { state: string; shape: string }> = {
  "not declared": { state: "Not declared", shape: "failed" },
  "not allowed": { state: "Not allowed", shape: "failed" },
};

const lookOf = (state: NeedState) => LACKS[state as keyof typeof LACKS] ?? LOOKS[state as State];

const DESCRIPTION = "No description: SKILL.md names none.";

/** The row of a need; `secrets` says whether the person may open "/secrets". */
function needRow(need: Need, secrets: boolean): NeedRow {
  const look = need.state && lookOf(need.state);
  const lacks =
    need.lacking.length > 0
      ? `${need.kind === "Secret" ? "Not declared by" : "Not in the egress of"} ${agentsText(need.lacking)}`
      : undefined;
  const from = need.references.length > 0 ? `From ${need.references.join(", ")}` : undefined;
  const detail = [from, lacks].filter(Boolean).join(" · ") || undefined;
  return {
    kind: need.kind,
    name: need.name,
    detail,
    state: look?.state,
    stateClass: look && `osf-state osf-state-${look.shape}`,
    ...(secrets && need.state === "missing"
      ? { action: { href: `/secrets?name=${encodeURIComponent(need.worst as string)}`, text: "Store a value" } }
      : {}),
  };
}

/** The rows of the needs, and the name of their list when there is one. */
const needRows = (needs: Need[], secrets: boolean, label: string) => ({
  needsLabel: needs.length > 0 ? label : undefined,
  needs: needs.map((need) => needRow(need, secrets)),
});

const sourceOf = (skill: Skill): string => `${skill.source.folder} in the factory's repository`;

const usedBy = (skill: Skill): string => `Used by ${agentsText(skill.agents.map((agent) => agent.name))}`;

/** The page "/skills": every skill, with what it needs; `needs` gives the needs of a skill. */
export function skillsData(
  shell: ShellData,
  skills: Skill[],
  needs: (skill: Skill) => Need[],
  notes: string[],
  secrets: boolean,
): SkillsData {
  return {
    shell,
    notes,
    empty: skills.length === 0,
    rows: skills.map((skill) => ({
      name: skill.name,
      href: `/skills/${encodeURIComponent(skill.name)}`,
      description: skill.description ?? DESCRIPTION,
      detail: `${sourceOf(skill)} · ${usedBy(skill)}`,
      ...needRows(needs(skill), secrets, `What ${skill.name} needs`),
      problems: skill.problems.length > 0 ? "Fails factory lint" : undefined,
    })),
  };
}

/** A skill's page: its Markdown, its files, its agents and what it needs. */
export function skillData(shell: ShellData, skill: Skill, needs: Need[], notes: string[], secrets: boolean): SkillData {
  return {
    shell,
    notes,
    name: skill.name,
    description: skill.description ?? DESCRIPTION,
    source: sourceOf(skill),
    problems: skill.problems,
    agents: skill.agents.map((agent) => {
      const lacks = [...agent.lacks.secrets, ...agent.lacks.hosts];
      return { name: agent.name, detail: lacks.length > 0 ? `Lacks ${lacks.join(", ")}` : "Has what the skill needs" };
    }),
    ...needRows(needs, secrets, "This skill needs"),
    files: skill.files,
    shown: skill.body !== null,
    html: htmlOf(skill.body ?? ""),
  };
}
