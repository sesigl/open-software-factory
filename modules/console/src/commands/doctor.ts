// console doctor: checks each server of the factory, its token and the factory definition, and prints one fix per
// failure (ADR 0086). It exits 1 when a check fails. The page /health shows the same.
import { type Api, probe } from "../adapters/apis.ts";
import { readFactory } from "../adapters/factory-file.ts";
import { type Item, report, type Server, serverItems } from "../domain/doctor.ts";
import { list } from "../domain/runs.ts";

type Env = Record<string, string | undefined>;

/** A route of each server that needs the token and answers 200 or 404 when the token is right. */
const TOKEN_ROUTES: Record<string, string> = {
  foreman: "/v1/runs",
  intake: "/v1/work-items/wi_00000000000000000000",
  gatekeeper: "/v1/gates/g0000000000000000",
};

function servers(env: Env): (Server & Api)[] {
  const urls = list(env.CONSOLE_FOREMAN_URL);
  const tokens = list(env.CONSOLE_FOREMAN_TOKEN);
  const found: (Server & Api)[] = urls.map((url, index) => ({
    name: urls.length > 1 ? `foreman ${index + 1}` : "foreman",
    url,
    token: tokens[index] ?? tokens[0],
    urlVariable: "CONSOLE_FOREMAN_URL",
    tokenVariable: "CONSOLE_FOREMAN_TOKEN",
    serverToken: "FOREMAN_API_TOKEN",
  }));
  for (const name of ["intake", "gatekeeper"]) {
    const prefix = `CONSOLE_${name.toUpperCase()}`;
    const url = env[`${prefix}_URL`];
    if (url)
      found.push({
        name,
        url,
        token: env[`${prefix}_TOKEN`],
        urlVariable: `${prefix}_URL`,
        tokenVariable: `${prefix}_TOKEN`,
        serverToken: `${name.toUpperCase()}_API_TOKEN`,
      });
  }
  return found;
}

export async function examine(env: Env): Promise<Item[]> {
  const items = (
    await Promise.all(
      servers(env).map(async (server) => {
        const tokenRoute = TOKEN_ROUTES[server.name.split(" ")[0] as string] as string;
        const [health, token] = await Promise.all([probe(server, "/v1/health", true), probe(server, tokenRoute)]);
        return serverItems(server, health, token.status);
      }),
    )
  ).flat();
  if (!env.CONSOLE_FOREMAN_URL)
    items.unshift({
      name: "foreman",
      ok: false,
      detail: "set CONSOLE_FOREMAN_URL to the base URL of the foreman's API",
    });
  const factory = env.CONSOLE_FACTORY || "factory.yaml";
  try {
    const definition = readFactory(factory);
    items.push(
      definition?.agents && Object.keys(definition.agents).length
        ? { name: "factory", ok: true }
        : { name: "factory", ok: false, detail: `${factory} declares no agent: check CONSOLE_FACTORY` },
    );
  } catch (failure) {
    items.push({ name: "factory", ok: false, detail: `${(failure as Error).message}: check CONSOLE_FACTORY` });
  }
  return items;
}

export async function doctor(env: Env) {
  const items = await examine(env);
  return { lines: report(items), exitCode: items.every(({ ok }) => ok) ? 0 : 1 };
}
