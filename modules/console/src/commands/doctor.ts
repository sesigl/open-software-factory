// console doctor: checks each server of the factory, its token and the factory definition, and prints one fix per
// failure (ADR 0086). It exits 1 when a check fails. The page /health shows the same.
import { readFileSync } from "node:fs";
import { type Api, probe } from "../adapters/apis.ts";
import { readFactory } from "../adapters/factory-file.ts";
import { groupsItem, type Item, report, type Server, serverItems } from "../domain/doctor.ts";
import { list } from "../domain/runs.ts";

type Env = Record<string, string | undefined>;

/** A route of each server that needs the token and answers 200 or 404 when the token is right. */
const TOKEN_ROUTES: Record<Server["kind"], string> = {
  foreman: "/v1/runs",
  intake: "/v1/work-items/wi_00000000000000000000",
  gatekeeper: "/v1/gates/g0000000000000000",
};

function servers(env: Env): (Server & Api)[] {
  const urls = list(env.CONSOLE_FOREMAN_URL);
  const tokens = list(env.CONSOLE_FOREMAN_TOKEN);
  const found: (Server & Api)[] = urls.map((url, index) => ({
    kind: "foreman",
    name: urls.length > 1 ? `foreman ${index + 1}` : "foreman",
    url,
    token: tokens[index] ?? tokens[0],
  }));
  for (const kind of ["intake", "gatekeeper"] as const) {
    const url = env[`CONSOLE_${kind.toUpperCase()}_URL`];
    if (url) found.push({ kind, name: kind, url, token: env[`CONSOLE_${kind.toUpperCase()}_TOKEN`] });
  }
  return found;
}

/** The check groups of the gatekeeper's groups file (ADR 0114). */
function groups(file: string): Item {
  try {
    return groupsItem(JSON.parse(readFileSync(file, "utf8")), file);
  } catch (failure) {
    return { name: "groups", ok: false, detail: `${(failure as Error).message}: check CONSOLE_GROUPS` };
  }
}

export async function examine(env: Env): Promise<Item[]> {
  const items = (
    await Promise.all(
      servers(env).map(async (server) => {
        const [health, token] = await Promise.all([
          probe(server, "/v1/health"),
          probe(server, TOKEN_ROUTES[server.kind]),
        ]);
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
    readFactory(factory);
    items.push({ name: "factory", ok: true });
  } catch (failure) {
    items.push({ name: "factory", ok: false, detail: `${(failure as Error).message}: check CONSOLE_FACTORY` });
  }
  if (env.CONSOLE_GROUPS) items.push(groups(env.CONSOLE_GROUPS));
  return items;
}

export async function doctor(env: Env) {
  const items = await examine(env);
  return { lines: report(items), exitCode: items.every(({ ok }) => ok) ? 0 : 1 };
}
