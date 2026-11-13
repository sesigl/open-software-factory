// What `console doctor` and the page /health find (ADR 0086): one item per check, with what to do when it fails.

export interface Item {
  name: string;
  ok: boolean;
  /** What failed and how to fix it, when `ok` is false. */
  detail?: string;
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

/** The lines of `console doctor`: one per item, and the count when every check is ok. */
export function report(items: Item[]): string[] {
  const lines = items.map(({ name, ok, detail }) => (ok ? `ok    ${name}` : `FAIL  ${name}: ${detail}`));
  return items.every(({ ok }) => ok) ? [...lines, `all ${items.length} checks ok`] : lines;
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
