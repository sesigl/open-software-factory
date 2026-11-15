// The data of the page "/skills" (src/web/pages/skills.astro) and of a skill's page "/skills/<name>"
// (src/web/pages/skills/skill.astro), in the shell of the new look (ADR 0133, ADR 0141). The skill's Markdown comes
// here as safe HTML, which the command made; every other value is text that the template escapes.
import type { CatalogSkill } from "@opensoftware/contracts";
import type { ShellData } from "@opensoftware/ui";
import { type Edit, type Listed, lineOf, type Pull, sentenceOf, stateOf } from "../domain/changes.ts";
import { agentsText, type State } from "../domain/secrets.ts";
import type { Need, NeedState, Switch } from "../domain/skills.ts";
import { LOOKS as LOOKS_OF_CHANGES } from "./changes.ts";
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

export interface AgentRow {
  name: string;
  /** Whether it has the skill and what it lacks, or "Switching on" or "Switching off" while a change is open. */
  detail: string;
  /** The open change of the switch: its state and its pull request. */
  change?: { state: string; stateClass: string; link: { href: string; text: string } };
  /** The switch: a form to the page that asks first, with its button's text. */
  button?: { action: string; text: string };
}

/** What the switches of a skill's page need (ADR 0149). */
export interface Switches {
  /** The agents of the factory. */
  agents: string[];
  /** Why the person cannot switch the skill, or undefined when the person can. */
  why: string | undefined;
  /** The open changes that switch the skill, by agent. */
  changes: Map<string, { pull: Listed | Pull; on: boolean }>;
}

export interface SkillData {
  shell: ShellData;
  notes: string[];
  name: string;
  description: string;
  source: string;
  problems: string[];
  /** Each agent of the factory: whether it has the skill, its open change, or its switch. */
  agents: AgentRow[];
  /** Why the page has no switch, like a factory from a local folder, or undefined when it has. */
  switchNote: string | undefined;
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

/** Where a skill comes from: a folder of the factory's repository, or of another one at its pinned commit. */
function sourceOf({ source }: CatalogSkill): string {
  if (!source.repository) return `${source.folder} in the factory's repository`;
  const pin = source.commit ? ` at ${source.commit.slice(0, 7)}` : ", not pinned in factory.lock";
  return `${source.folder} in ${source.repository}${pin}`;
}

const usedBy = (skill: CatalogSkill): string => `Used by ${agentsText(skill.agents.map((agent) => agent.name))}`;

/** The page "/skills": every skill, with what it needs; `needs` gives the needs of a skill. */
export function skillsData(
  shell: ShellData,
  skills: CatalogSkill[],
  needs: (skill: CatalogSkill) => Need[],
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

/** The row of an agent on a skill's page. */
function agentRow(skill: CatalogSkill, name: string, switches: Switches): AgentRow {
  const user = skill.agents.find((agent) => agent.name === name);
  const lacks = user ? [...user.lacks.secrets, ...user.lacks.hosts] : [];
  const has = lacks.length > 0 ? `Lacks ${lacks.join(", ")}` : "Has what the skill needs";
  const open = switches.changes.get(name);
  if (open) {
    const look = LOOKS_OF_CHANGES[stateOf(open.pull)];
    return {
      name,
      detail: open.on ? "Switching on" : "Switching off",
      change: {
        state: look.state,
        stateClass: `osf-state osf-state-${look.shape}`,
        link: { href: open.pull.url, text: `Pull request #${open.pull.number}` },
      },
    };
  }
  const action = `/skills/${encodeURIComponent(skill.name)}/switch`;
  return {
    name,
    detail: user ? has : "Does not have the skill",
    ...(switches.why ? {} : { button: { action, text: user ? "Switch off" : "Switch on" } }),
  };
}

/** A skill's page: its Markdown, its files, each agent of the factory with its switch, and what it needs. */
export function skillData(
  shell: ShellData,
  skill: CatalogSkill,
  needs: Need[],
  notes: string[],
  secrets: boolean,
  html: string,
  switches: Switches,
): SkillData {
  const names = [...new Set([...skill.agents.map((agent) => agent.name), ...switches.agents])].sort();
  return {
    shell,
    notes,
    name: skill.name,
    description: skill.description ?? DESCRIPTION,
    source: sourceOf(skill),
    problems: skill.problems,
    agents: names.map((name) => agentRow(skill, name, switches)),
    switchNote: switches.why,
    ...needRows(needs, secrets, "This skill needs"),
    files: skill.files,
    shown: skill.body !== null,
    html,
  };
}

/** The page that asks before a switch (src/web/pages/skills/switch.astro). */
export interface SwitchData {
  shell: ShellData;
  title: string;
  /** What the person's confirmation does. */
  effect: string;
  /** Each edit of the change as a sentence, like "The agent review may reach the host api.linear.app.". */
  edits: string[];
  /** The edits as the line that the form "Propose change" posts to "/changes" in the field "edits". */
  line: string;
  /** The way back to the skill's page. */
  back: string;
}

/** The page that asks before the switch of the skill for the agent, with every edit of its change (ADR 0149). */
export function switchData(shell: ShellData, skill: string, agent: string, change: Switch): SwitchData {
  const what = change.on ? `${agent} has the skill` : `${agent} no longer has the skill`;
  const store = change.edits.some(({ edit }) => edit === "add-secret")
    ? " An admin or a factory engineer stores the value of each added secret on Secrets."
    : "";
  return {
    shell,
    title: `Switch ${change.on ? "on" : "off"} ${skill} for ${agent}?`,
    effect: `The console opens a pull request with these edits on the factory's repository. The forge merges it when its check factory passes, and ${what} from its next run.${store}`,
    edits: change.edits.map((edit: Edit) => sentenceOf(edit)),
    line: lineOf(change.edits),
    back: `/skills/${encodeURIComponent(skill)}`,
  };
}
