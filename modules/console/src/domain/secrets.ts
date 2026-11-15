// The secrets of the page /secrets and of `console doctor` (ADR 0137): which secrets the factory's agents declare, and
// the state of each beside the names in the secret store. Without I/O; no value ever comes here.

/** A secret as the store's adapter lists it: its name, version, time and person, never its value. */
export interface Stored {
  name: string;
  version: number;
  changed: string;
  /** The person of the last change, or null when another program stored it. */
  by: string | null;
}

/** A secret that the factory's agents declare as "ref:<provider>/<name>". */
export interface Declared {
  provider: string;
  name: string;
  /** The agents that declare it, sorted. */
  agents: string[];
  /** The hosts those agents may reach, sorted: the only ones the egress proxy sends the value to. */
  hosts: string[];
}

/**
 * "missing": declared from OpenBao without a value; "unknown": declared from OpenBao while the store does not answer;
 * "set": declared and stored; "outside": declared from another provider, like "env" or "file"; "not used": stored and
 * declared by no agent.
 */
export type State = "missing" | "unknown" | "set" | "outside" | "not used";

export interface Secret {
  name: string;
  state: State;
  declared?: Declared;
  stored?: Stored;
}

const REFERENCE = /^ref:(?<provider>[a-z][a-z0-9-]*)\/(?<name>.+)$/;
const ORDER: State[] = ["missing", "unknown", "set", "outside", "not used"];

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

/** The secrets that the agents of a factory definition declare, by provider and name. */
export function declaredOf(agents: Record<string, Record<string, unknown>> | undefined): Declared[] {
  const found = new Map<string, Declared>();
  for (const [agent, config] of Object.entries(agents ?? {})) {
    const hosts = strings((config.sandbox as Record<string, unknown> | undefined)?.egress);
    for (const reference of strings(config.secrets)) {
      const match = REFERENCE.exec(reference)?.groups as { provider: string; name: string } | undefined;
      if (!match) continue;
      const { provider, name } = match;
      const entry = found.get(`${provider}/${name}`) ?? { provider, name, agents: [], hosts: [] };
      entry.agents = [...new Set([...entry.agents, agent])].sort();
      entry.hosts = [...new Set([...entry.hosts, ...hosts])].sort();
      found.set(`${provider}/${name}`, entry);
    }
  }
  return [...found.values()];
}

/** The secrets of OpenBao among the declared ones. */
export const fromOpenBao = (declared: Declared[]): Declared[] =>
  declared.filter(({ provider }) => provider === "openbao");

/**
 * One secret per declared secret and per stored name that no agent declares from OpenBao, the missing ones first,
 * then by name. `stored` is undefined when the store did not answer.
 */
export function secretsOf(declared: Declared[], stored: Stored[] | undefined): Secret[] {
  const names = new Map((stored ?? []).map((secret) => [secret.name, secret]));
  const secrets: Secret[] = declared.map((each) => {
    if (each.provider !== "openbao") return { name: each.name, state: "outside", declared: each };
    const found = names.get(each.name);
    names.delete(each.name);
    if (!stored) return { name: each.name, state: "unknown", declared: each };
    return found
      ? { name: each.name, state: "set", declared: each, stored: found }
      : { name: each.name, state: "missing", declared: each };
  });
  for (const unused of names.values()) secrets.push({ name: unused.name, state: "not used", stored: unused });
  return secrets.sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.name.localeCompare(b.name));
}

/** The words "the agent a" or "the agents a and b", for a sentence. */
export function agentsText(agents: string[]): string {
  const last = agents.at(-1);
  return agents.length > 1 ? `the agents ${agents.slice(0, -1).join(", ")} and ${last}` : `the agent ${last}`;
}

/** The time of a change in UTC to the minute, like "2026-11-14 20:01 UTC". */
export const minuteOf = (time: string): string => `${new Date(time).toISOString().slice(0, 16).replace("T", " ")} UTC`;
