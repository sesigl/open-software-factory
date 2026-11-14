// What `console doctor` and the page /health find (ADR 0086): one item per check, with what to do when it fails.
import { agentsText, type Declared, type Stored } from "./secrets.ts";

export interface Item {
  name: string;
  ok: boolean;
  /** What failed and how to fix it, when `ok` is false, or what to do soon, when `warn` is set. */
  detail?: string;
  /** A check that holds, but needs a person soon: `console doctor` prints WARN, and /health says "warning". */
  warn?: boolean;
}

/**
 * A server of the factory as the console reaches it. Its kind names the variables a person sets to fix it: the
 * console's CONSOLE_<KIND>_URL and CONSOLE_<KIND>_TOKEN, and the server's own <KIND>_API_TOKEN.
 */
export interface Server {
  kind: "foreman" | "intake" | "gatekeeper";
  name: string;
  url: string;
}

interface Health {
  checks: Item[];
}

/** The items of one server from the status and body of its /v1/health, and the status of a route that needs a token. */
export function serverItems(server: Server, health: { status: number; body?: unknown }, tokenStatus: number): Item[] {
  const { kind, name, url } = server;
  const KIND = kind.toUpperCase();
  if (health.status === 0)
    return [{ name, ok: false, detail: `no answer at ${url}: check CONSOLE_${KIND}_URL and that ${name} runs` }];
  const checks = (health.body as Health | undefined)?.checks;
  const items: Item[] = Array.isArray(checks)
    ? checks.map((check) => ({ ...check, name: `${name} ${check.name}` }))
    : [
        {
          name,
          ok: false,
          detail: `${url}/v1/health answered ${health.status}: update ${kind} to a release with /v1/health`,
        },
      ];
  const refused = tokenStatus === 401 || tokenStatus === 403;
  items.push({
    name: `${name} token`,
    ok: !refused,
    detail: `${name} refuses the token: set CONSOLE_${KIND}_TOKEN to its ${KIND}_API_TOKEN`,
  });
  return items;
}

/** The lines of `console doctor`: one per item, and the count when every check is ok, with the warnings. */
export function report(items: Item[]): string[] {
  const line = ({ name, ok, detail, warn }: Item) =>
    ok ? (warn ? `WARN  ${name}: ${detail}` : `ok    ${name}`) : `FAIL  ${name}: ${detail}`;
  const warns = items.filter(({ warn }) => warn).length;
  const count = `all ${items.length} checks ok${warns ? `, ${warns} warns` : ""}`;
  return items.every(({ ok }) => ok) ? [...items.map(line), count] : items.map(line);
}

/** How long the console's token for the secret store may still live before `console doctor` warns: 7 days. */
const TOKEN_WARNING_SECONDS = 7 * 86_400;

/** What an adapter of the secrets port answered: its JSON lines, or its error. */
type Answer<T> = { ok: true; body: T[] } | { ok: false; note: string };

interface Probe {
  ttl: number;
  expires: string | null;
}

/**
 * The checks of the secret store, when the factory declares a secret of OpenBao (ADR 0137): the store answers to the
 * console's token, the token does not end within 7 days, and each declared secret has a value.
 */
export function secretItems(declared: Declared[], probe: Answer<Probe>, listed: Answer<Stored>): Item[] {
  const failed = [probe, listed].find((answer) => !answer.ok) as { note: string } | undefined;
  if (failed) {
    const detail = `${failed.note}: check OSF_OPENBAO_ADDR, OSF_OPENBAO_TOKEN and CONSOLE_SECRETS_ADAPTER`;
    return [{ name: "secrets", ok: false, detail }];
  }
  // probe prints one line.
  const { ttl, expires } = (probe as { body: Probe[] }).body[0] as Probe;
  // A token with the ttl 0 does not end, like OpenBao's root token.
  const ends = ttl > 0 && ttl < TOKEN_WARNING_SECONDS;
  const advice = `the token in OSF_OPENBAO_TOKEN ends at ${expires}, within 7 days: give the console a new token`;
  const names = new Set((listed as { body: Stored[] }).body.map(({ name }) => name));
  return [
    { name: "secrets", ok: true },
    { name: "secrets token", ok: true, ...(ends ? { warn: true, detail: advice } : {}) },
    ...declared.map(({ name, agents }) => ({
      name: `secret ${name}`,
      ok: names.has(name),
      detail: `no value in the store for ${agentsText(agents)}: store one on /secrets`,
    })),
  ];
}

/** The member that the reference groups.json ships in place of a person (ADR 0114). */
export const EXAMPLE_MEMBER = "slack:U0EXAMPLE";

/** The check groups: the names of the groups whose members are all the example's, from the parsed groups file. */
export function groupsItem(groups: unknown, file: string): Item {
  const empty = Object.entries(groups ?? {}).flatMap(([name, members]: [string, unknown]) =>
    Array.isArray(members) && !members.some((member) => member !== EXAMPLE_MEMBER) ? [`"${name}"`] : [],
  );
  const detail = `${empty.join(", ")} has no member but the example's ${EXAMPLE_MEMBER}: put its people in ${file}`;
  return { name: "groups", ok: empty.length === 0, detail };
}

/** The admin that the reference access.yaml ships in place of a person (ADR 0134). */
export const EXAMPLE_ADMIN = "admin@example.com";

/** The check of the access file with the sign-in: it holds, and it has an admin who is not the example. */
export function accessItem(problems: string[], admins: string[], file: string): Item {
  if (problems.length) return { name: "access", ok: false, detail: `${problems.join("; ")}: check CONSOLE_ACCESS` };
  const ok = admins.some((admin) => admin !== EXAMPLE_ADMIN);
  const detail = `${file} has no admin but the example's ${EXAMPLE_ADMIN}: put your admins in ${file}`;
  return { name: "access", ok, detail };
}

/** The model routes of the factory definition's agents, each once, in the order of the agents. */
export const routesOf = (agents: Record<string, Record<string, unknown>> | undefined): string[] => [
  ...new Set(Object.values(agents ?? {}).map(({ model }) => String(model))),
];

/** The item of one model route from the status of its call; 0 means the gateway did not answer. */
export function routeItem(route: string, status: number): Item {
  const detail =
    status === 0
      ? "no answer: check CONSOLE_MODEL_URL and that the gateway runs"
      : `the gateway answered ${status}: check the route in the gateway's config and its provider key`;
  return { name: `model ${route}`, ok: status === 200, detail };
}

/** The item of the harness from whether it answered ACP `initialize`. */
export const harnessItem = (ok: boolean): Item => ({
  name: "harness",
  ok,
  detail: "it did not answer ACP initialize: check CONSOLE_HARNESS_COMMAND",
});

/** The item of the span's way from the collector to the trace store (ADR 0120). */
export function traceItem({ sent, found }: { sent: boolean; found: boolean }): Item {
  const detail = sent
    ? "the span did not reach the trace store in 5 s: check the collector's exporter and CONSOLE_TRACES_URL"
    : "no collector took the span: check CONSOLE_OTLP_URL and that the collector runs";
  return { name: "traces", ok: found, detail };
}

/** The host the sandbox probe sends its request to; the probe's sandbox allows no host, so its proxy must refuse it. */
export const DENIED_HOST = "example.com";

/** The item of the sandbox from what the adapter's probe printed and its first error line (ADR 0120). */
export function sandboxItem({ stdout, stderr }: { stdout: string; stderr: string }): Item {
  if (stdout.trim() === `refused ${DENIED_HOST}`) return { name: "sandbox", ok: true };
  const detail =
    stdout.trim() === `reached ${DENIED_HOST}`
      ? `a sandbox reached ${DENIED_HOST}, which its egress does not allow: check the egress proxy of the sandbox adapter`
      : `${stderr.split("\n")[0] || "the probe printed no outcome"}: check CONSOLE_SANDBOX_COMMAND and CONSOLE_SANDBOX_TEMPLATE`;
  return { name: "sandbox", ok: false, detail };
}

/** What became of the doctor's ping (ADR 0120): published and seen by a foreman, or where it stopped. */
export type PingOutcome = "seen" | "not seen" | "no stream" | "no answer";

const PING_FIXES: Record<Exclude<PingOutcome, "seen">, string> = {
  "not seen":
    "the foreman did not receive the ping in 10 s: update the foreman to a release that shows /v1/doctor/pings and check its FOREMAN_NATS_URL",
  "no stream":
    "no stream takes osf.doctor.ping.v1: start the foreman with FOREMAN_NATS_URL set to the same server, which adds the stream OSF",
  "no answer": "no answer from NATS: check CONSOLE_NATS_URL and that NATS runs",
};

/** The item of the event path from NATS to the foreman (ADR 0120). */
export const eventItem = (outcome: PingOutcome): Item =>
  outcome === "seen" ? { name: "events", ok: true } : { name: "events", ok: false, detail: PING_FIXES[outcome] };
