// The skills of the pages "/skills" and "/skills/<name>" (ADR 0141): what `factory skills` prints, and the state of
// each secret and host a skill needs, from the references its agents give and the states the secrets page knows.
// Without I/O.
import { declaredOf, type Secret, type State, type Stored, secretsOf } from "./secrets.ts";

/** A skill as `factory skills` prints it (modules/factory-spec/README.md#the-skills-as-json). */
export interface Skill {
  name: string;
  description: string | null;
  /** Where the skill comes from: a folder of the factory's repository, relative to its folder. */
  source: { folder: string };
  needs: { secrets: string[]; hosts: string[] };
  /** Each agent that uses it: the reference that gives each needed secret, and what it lacks. */
  agents: { name: string; secrets: Record<string, string>; lacks: { secrets: string[]; hosts: string[] } }[];
  files: string[];
  body: string | null;
  problems: string[];
}

/** The state of a need: one of the secrets page's, or a need an agent of the skill lacks. */
export type NeedState = State | "not declared" | "not allowed";

/** A secret or a host a skill needs, with the agents that lack it and its state. */
export interface Need {
  kind: "secret" | "host";
  name: string;
  /** The references the agents give for a secret, sorted. */
  references: string[];
  /** The agents that lack it. */
  lacking: string[];
  /** None for a host every agent allows, and for a secret of OpenBao without a store. */
  state: NeedState | undefined;
  /** The name in the store of a missing secret of OpenBao, for the link to store its value. */
  missing: string | undefined;
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
  return new Map(
    secretsOf(declaredOf(agents), stored).flatMap((secret) =>
      secret.declared ? [[`ref:${secret.declared.provider}/${secret.name}`, secret] as const] : [],
    ),
  );
}

/**
 * What a skill needs. `states` holds the state of each reference; `store` says whether the console has a store, so
 * that a secret of OpenBao has a state at all.
 */
export function needsOf(skill: Skill, states: Map<string, Secret>, store: boolean): Need[] {
  const lacking = (kind: "secrets" | "hosts", name: string) =>
    skill.agents.filter((agent) => agent.lacks[kind].includes(name)).map((agent) => agent.name);
  const secrets = skill.needs.secrets.map((name): Need => {
    const references = [...new Set(skill.agents.flatMap((agent) => agent.secrets[name] ?? []))].sort();
    const found = references.flatMap((reference) => states.get(reference) ?? []);
    const known = found.filter((secret) => store || secret.state !== "unknown");
    const worst = WORST.find((state) => known.some((secret) => secret.state === state));
    const missing = found.find((secret) => secret.state === "missing")?.name;
    const lacks = lacking("secrets", name);
    return { kind: "secret", name, references, lacking: lacks, state: lacks.length ? "not declared" : worst, missing };
  });
  const hosts = skill.needs.hosts.map((name): Need => {
    const lacks = lacking("hosts", name);
    return {
      kind: "host",
      name,
      references: [],
      lacking: lacks,
      state: lacks.length ? "not allowed" : undefined,
      missing: undefined,
    };
  });
  return [...secrets, ...hosts];
}
