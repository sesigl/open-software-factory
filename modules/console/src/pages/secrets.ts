// The data of the page "/secrets" (src/web/pages/secrets.astro) and of the page that asks before a delete
// (src/web/pages/secrets/delete.astro), in the shell of the new look (ADR 0133, ADR 0137). No value comes here: the
// page shows names, states, versions and people, and its form's field for the value is always empty.
import type { ShellData } from "@opensoftware/ui";
import { agentsText, type Declared, minuteOf, type Secret, type State, type Stored } from "../domain/secrets.ts";

export interface SecretRow {
  name: string;
  /** The state as a word, like "Missing". */
  state: string;
  /** The classes of the state: its shape and colour. */
  stateClass: string;
  /** The class of a row that waits for a person: a declared secret without a value. */
  rowClass: string | undefined;
  /** Who needs it, and where its value comes from or who stored it when. */
  detail: string;
  /** The row's link, like "Replace", whose name ends with the secret's name for a screen reader. */
  action?: { href: string; text: string };
}

export interface SecretsData {
  shell: ShellData;
  /** What failed, like a store that does not answer or a name the adapter refused. */
  notes: string[];
  rows: SecretRow[];
  empty: boolean;
  /** The form "Store a value": the name it is for, and the hosts that get the value. */
  form: { name: string; reach: string };
}

export interface DeleteData {
  shell: ShellData;
  title: string;
  name: string;
  /** What the delete does. */
  effect: string;
}

const LOOKS: Record<State, { state: string; shape: string }> = {
  missing: { state: "Missing", shape: "failed" },
  unknown: { state: "Unknown", shape: "cancelled" },
  set: { state: "Set", shape: "complete" },
  outside: { state: "Set outside the UI", shape: "complete" },
  "not used": { state: "Not used", shape: "cancelled" },
};

const link = (path: string, name: string) => `${path}?name=${encodeURIComponent(name)}`;

/** The version, the time and the person of the last change. */
const changeOf = ({ version, changed, by }: Stored): string =>
  `version ${version}, set ${by ? `by ${by} ` : ""}on ${minuteOf(changed)}`;

/** Where a value of the providers "env" and "file" comes from: the sandbox adapter's variable or file. */
const outsideOf = ({ provider, name }: Declared): string =>
  provider === "env"
    ? `from the variable OSF_SECRET_${name} of the sandbox adapter`
    : `from the ${provider === "file" ? `file ${name} in OSF_SECRETS_DIR` : `provider ${provider}`} of the sandbox adapter`;

function detailOf({ state, declared, stored }: Secret): string {
  const used = declared && `Used by ${agentsText(declared.agents)}`;
  if (state === "set") return `${used} · ${changeOf(stored as Stored)}`;
  if (state === "outside") return `${used} · ${outsideOf(declared as Declared)}`;
  if (state === "not used") return `No agent declares it · ${changeOf(stored as Stored)}`;
  return `Needed by ${agentsText((declared as Declared).agents)}`;
}

function actionOf({ state, name }: Secret): SecretRow["action"] {
  if (state === "missing") return { href: link("/secrets", name), text: "Store a value" };
  if (state === "set") return { href: link("/secrets", name), text: "Replace" };
  return state === "not used" ? { href: link("/secrets/delete", name), text: "Delete" } : undefined;
}

const rowOf = (secret: Secret): SecretRow => ({
  name: secret.name,
  state: LOOKS[secret.state].state,
  stateClass: `osf-state osf-state-${LOOKS[secret.state].shape}`,
  rowClass: secret.state === "missing" ? "osf-missing" : undefined,
  detail: detailOf(secret),
  action: actionOf(secret),
});

/** The count beside "Secrets" in the navigation, like "1 missing". */
export const missingOf = (secrets: Secret[]): string | undefined => {
  const count = secrets.filter(({ state }) => state === "missing").length;
  return count ? `${count} missing` : undefined;
};

/** The hosts that get the value of the secret of this name, as a sentence. */
function reachOf(secrets: Secret[], name: string): string {
  if (!name) return "Sent only to the hosts of the agents that declare it.";
  const declared = secrets.find((secret) => secret.name === name && secret.declared?.provider === "openbao")?.declared;
  const hosts = declared?.hosts ?? [];
  return hosts.length
    ? `Sent only to ${hosts.join(", ")}.`
    : "Sent to no host: no agent that declares it may reach one.";
}

/**
 * The page: the secrets, the missing ones first, and the form for the secret of `chosen`, or else for the first
 * missing one.
 */
export function secretsData(
  shell: ShellData,
  secrets: Secret[],
  notes: string[],
  chosen: string | undefined,
): SecretsData {
  const name = chosen ?? secrets.find(({ state }) => state === "missing")?.name ?? "";
  return {
    shell,
    notes,
    rows: secrets.map(rowOf),
    empty: secrets.length === 0,
    form: { name, reach: reachOf(secrets, name) },
  };
}

/** The page that asks before the secret of this name is deleted. */
export const deleteData = (shell: ShellData, name: string): DeleteData => ({
  shell,
  title: `Delete ${name}?`,
  name,
  effect: `This removes ${name} with every version from the store. An agent that declares ref:openbao/${name} gets no value for it in its next sandbox, until someone stores a new one.`,
});
