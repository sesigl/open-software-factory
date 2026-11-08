// What `console doctor` and the page /health find (ADR 0086): one item per check, with what to do when it fails.

export interface Item {
  name: string;
  ok: boolean;
  /** What failed and how to fix it, when `ok` is false. */
  detail?: string;
}

/** A server of the factory as the console reaches it, and the variables a person sets to fix it. */
export interface Server {
  name: string;
  url: string;
  /** The console's variables of its URL and token, like CONSOLE_INTAKE_URL and CONSOLE_INTAKE_TOKEN. */
  urlVariable: string;
  tokenVariable: string;
  /** The server's own token variable, like INTAKE_API_TOKEN. */
  serverToken: string;
}

interface Health {
  status: string;
  checks: { name: string; ok: boolean; detail?: string }[];
}

const isHealth = (body: unknown): body is Health =>
  typeof body === "object" && body !== null && Array.isArray((body as Health).checks);

/** The items of one server from the status and body of its /v1/health, and the status of a route that needs a token. */
export function serverItems(server: Server, health: { status: number; body?: unknown }, tokenStatus: number): Item[] {
  if (health.status === 0)
    return [
      {
        name: server.name,
        ok: false,
        detail: `no answer at ${server.url}: check ${server.urlVariable} and that ${server.name} runs`,
      },
    ];
  const items: Item[] = isHealth(health.body)
    ? health.body.checks.map(({ name, ok, detail }) => ({
        name: `${server.name} ${name}`,
        ok,
        ...(ok ? {} : { detail: detail ?? "failing" }),
      }))
    : [
        {
          name: server.name,
          ok: false,
          detail: `${server.url}/v1/health answered ${health.status}: update ${server.name} to a release with /v1/health`,
        },
      ];
  const refused = tokenStatus === 401 || tokenStatus === 403;
  items.push({
    name: `${server.name} token`,
    ok: !refused && tokenStatus !== 0,
    ...(refused
      ? { detail: `${server.name} refuses the token: set ${server.tokenVariable} to its ${server.serverToken}` }
      : tokenStatus === 0
        ? { detail: `no answer at ${server.url}: check ${server.urlVariable}` }
        : {}),
  });
  return items;
}

/** The lines of `console doctor`: one per item, then the count. */
export function report(items: Item[]): string[] {
  const failed = items.filter(({ ok }) => !ok).length;
  return [
    ...items.map(({ name, ok, detail }) => (ok ? `ok    ${name}` : `FAIL  ${name}: ${detail}`)),
    failed ? `${failed} of ${items.length} checks failed` : `all ${items.length} checks ok`,
  ];
}
