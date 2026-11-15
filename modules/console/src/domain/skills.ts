// The skills of the pages "/skills" and "/skills/<name>" (ADR 0141): what `factory skills` prints, in the format
// skill-catalog of the contracts (ADR 0143), and the state of each secret and host a skill needs, from the references
// its agents give and the states the secrets page knows; the edits that switch a skill on or off for an agent, and the
// open changes that do (ADR 0149). Without I/O.
import type { CatalogSkill } from "@opensoftware/contracts";
import { type Edit, editsOfTitle, type Listed } from "./changes.ts";
import { declaredOf, type Secret, type State, type Stored, secretsOf } from "./secrets.ts";

/** The state of a need: one of the secrets page's, or a need an agent of the skill lacks. */
export type NeedState = State | "not declared" | "not allowed";

/** A secret or a host a skill needs, with the agents that lack it and its state. */
export interface Need {
  kind: "Secret" | "Host";
  name: string;
  /** The references the agents give for a secret, sorted. */
  references: string[];
  /** The agents that lack it. */
  lacking: string[];
  /** None for a host every agent allows, and for a secret of OpenBao without a store. */
  state: NeedState | undefined;
  /** The name of the secret with the worst state, like the name in the store of a missing one. */
  worst: string | undefined;
}

const WORST: State[] = ["missing", "unknown", "set", "outside"];

/**
 * The state of each reference the factory's agents declare, by reference: the secrets page's states with the store's
 * names, or "unknown" for those of OpenBao when `stored` is undefined.
 */
export function statesOf(
  agents: Record<string, Record<string, unknown>> | undefined,
  stored: Stored[] | undefined,
): Map<string, Secret> {
  // A stored secret that no agent declares has no provider, so no reference finds it.
  return new Map(
    secretsOf(declaredOf(agents), stored).map((secret) => [`ref:${secret.declared?.provider}/${secret.name}`, secret]),
  );
}

/**
 * What a skill needs. `states` holds the state of each reference; `store` says whether the console has a store, so
 * that a secret of OpenBao has a state at all.
 */
export function needsOf(skill: CatalogSkill, states: Map<string, Secret>, store: boolean): Need[] {
  const lacking = (kind: "secrets" | "hosts", name: string) =>
    skill.agents.filter((agent) => agent.lacks[kind].includes(name)).map((agent) => agent.name);
  const secrets = skill.needs.secrets.map((name): Need => {
    const references = [...new Set(skill.agents.flatMap((agent) => agent.secrets[name] ?? []))];
    const known = references
      .flatMap((reference) => states.get(reference) ?? [])
      .filter((secret) => store || secret.state !== "unknown");
    const worst = WORST.flatMap((state) => known.filter((secret) => secret.state === state))[0];
    const lacks = lacking("secrets", name);
    const state = lacks.length ? "not declared" : worst?.state;
    return { kind: "Secret", name, references, lacking: lacks, state, worst: worst?.name };
  });
  const hosts = skill.needs.hosts.map((name): Need => {
    const lacks = lacking("hosts", name);
    return {
      kind: "Host",
      name,
      references: [],
      lacking: lacks,
      state: lacks.length ? "not allowed" : undefined,
      worst: undefined,
    };
  });
  return [...secrets, ...hosts];
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

/** A path without "./" before it and "/" after it. */
const folderOf = (path: string): string => path.replace(/^\.\//, "").replace(/\/+$/, "");

/**
 * Whether an entry of an agent's skills in factory.yaml names this skill: a folder of the factory's repository, like
 * "./skills/release-notes", or "git+<url>#<ref>:<path>" of the skill's other repository (ADR 0146).
 */
export function namesSkill(entry: string, source: CatalogSkill["source"]): boolean {
  const remote = /^git\+(?<url>[^#]+)#[^:]+:(?<path>.+)$/.exec(entry)?.groups;
  if (source.repository) return remote?.url === source.repository && folderOf(remote.path ?? "") === source.folder;
  return !remote && folderOf(entry) === source.folder;
}

/** The variable that holds a secret reference in a sandbox, by factory-spec's rule (ADR 0140). */
const variableOf = (reference: string): string =>
  reference
    .slice(reference.indexOf("/") + 1)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_");

/** The provider of the secrets that a switch adds: the store an admin fills on "/secrets" (ADR 0137). */
const PROVIDER = { name: "openbao", range: "^0" };

/** A switch of a skill for an agent: on or off, and the edits of its change. */
export interface Switch {
  on: boolean;
  edits: Edit[];
}

/**
 * The edits that switch the skill on or off for the agent of factory.yaml (ADR 0149): off removes its entry; on adds
 * the provider, each secret reference and each host of the skill's needs that the agent lacks, then the entry with
 * which another agent names the skill. Undefined for an agent the factory does not declare.
 */
export function switchOf(
  skill: CatalogSkill,
  factory: { agents?: Record<string, Record<string, unknown>>; providers?: Record<string, unknown> },
  agent: string,
): Switch | undefined {
  const agents = factory.agents ?? {};
  const config = Object.hasOwn(agents, agent) ? agents[agent] : undefined;
  if (!config) return undefined;
  const own = strings(config.skills).find((entry) => namesSkill(entry, skill.source));
  if (own) return { on: false, edits: [{ edit: "remove-skill", target: agent, value: own }] };
  const entry = Object.values(agents)
    .flatMap((each) => strings(each.skills))
    .find((each) => namesSkill(each, skill.source)) as string;
  const variables = new Set(strings(config.secrets).map(variableOf));
  const secrets = skill.needs.secrets.filter((name) => !variables.has(name));
  const sandbox = config.sandbox as Record<string, unknown> | undefined;
  const egress = strings(sandbox?.egress);
  const hosts = sandbox ? skill.needs.hosts.filter((host) => !egress.includes(host)) : [];
  const declared = (factory.providers?.secrets ?? {}) as Record<string, unknown>;
  const provider: Edit[] =
    secrets.length > 0 && !Object.hasOwn(declared, PROVIDER.name)
      ? [{ edit: "add-secrets-provider", target: PROVIDER.name, value: PROVIDER.range }]
      : [];
  const references = secrets.map(
    (name): Edit => ({
      edit: "add-secret",
      target: agent,
      value: `ref:${PROVIDER.name}/${name.toLowerCase().replaceAll("_", "-")}`,
    }),
  );
  const added = hosts.map((host): Edit => ({ edit: "add-egress", target: agent, value: host }));
  return {
    on: true,
    edits: [...provider, ...references, ...added, { edit: "add-skill", target: agent, value: entry }],
  };
}

/**
 * The open changes of the console that switch this skill, by agent: the newest one's pull request, and whether it
 * switches the skill on. `pulls` are the console's changes, the newest first.
 */
export function switchesOf(pulls: Listed[], skill: CatalogSkill): Map<string, { pull: Listed; on: boolean }> {
  const found = new Map<string, { pull: Listed; on: boolean }>();
  for (const pull of pulls) {
    const read = editsOfTitle(pull.title);
    if (pull.state !== "open" || !read.ok) continue;
    for (const { edit, target, value } of read.edits)
      if ((edit === "add-skill" || edit === "remove-skill") && namesSkill(value, skill.source) && !found.has(target))
        found.set(target, { pull, on: edit === "add-skill" });
  }
  return found;
}
