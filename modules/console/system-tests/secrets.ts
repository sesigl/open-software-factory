// Shared setup of the secrets scenarios (ADR 0137): the testkit's OpenBao with a mount of the scenario, the console's
// token with the policy of the adapter's "policy write", a factory whose agents declare secrets, and a console that runs
// the built adapter secrets-openbao. The values are a test's own and worth nothing.
import type { Fakes, OpenBao, Page, Sut } from "@opensoftware/testkit";
import { foreman, healthyServer, serving, TOKEN_ROUTES } from "./console.ts";
import { accessYaml } from "./signin.ts";

/** A value no real system knows. */
export const VALUE = "lin_fake_value_51c2_not_a_token";

export const ADMIN = { "x-forwarded-email": "ada@acme.dev" };

/** What "/secrets" says in a console without roles. */
export const CLOSED =
  "no secrets: they need a person with the role admin, so set CONSOLE_SIGN_IN, or an access file with CONSOLE_USER_HEADER";

/**
 * The policy of the console's token for the mount, as "secrets-openbao policy write" prints it (ADR 0137): it writes,
 * lists and deletes secrets, and OpenBao refuses it a value.
 */
const writePolicy = (mount: string): string => `path "${mount}/data/*" {
  capabilities = ["create", "update"]
}
path "${mount}/metadata/*" {
  capabilities = ["read", "list", "update", "delete"]
}
`;

export interface Store {
  bao: OpenBao;
  /** The console's variables of the store and of its adapter. */
  env: Record<string, string>;
}

/**
 * The test store with the console's token, which lives `ttl`: by default 200 hours, longer than the 7 days in which
 * "console doctor" warns. And the console's variables for it.
 */
export async function store(sut: Sut, fakes: Fakes, ttl = "200h"): Promise<Store> {
  const bao = await fakes.openbao();
  const adapter = sut.adapter("secrets/openbao");
  const token = await bao.token(writePolicy(bao.mount), { ttl });
  return {
    bao,
    env: {
      CONSOLE_SECRETS_ADAPTER: adapter,
      OSF_OPENBAO_ADDR: bao.url,
      OSF_OPENBAO_TOKEN: token,
      OSF_OPENBAO_MOUNT: bao.mount,
    },
  };
}

/** An agent of the factory definition: the secrets it declares and the hosts it may reach. */
export interface AgentOf {
  secrets?: string[];
  egress?: string[];
}

/** A factory definition "acme" with these agents. */
export function factoryYaml(agents: Record<string, AgentOf>): string {
  const lines = ["version: 1", "factory: acme", "providers:", "  harness:", '    claude-code: "^2"', "  secrets:"];
  lines.push('    openbao: "^0"', "agents:");
  for (const [name, { secrets, egress }] of Object.entries(agents)) {
    lines.push(`  ${name}:`, "    harness: claude-code", `    model: routes/${name}`, `    prompt: ./${name}.md`);
    lines.push("    effort: high");
    if (secrets) lines.push("    secrets:", ...secrets.map((secret) => `      - ${secret}`));
    if (egress)
      lines.push(
        "    sandbox:",
        "      template: node-24",
        "      egress:",
        ...egress.map((host) => `        - ${host}`),
      );
  }
  return `${lines.join("\n")}\n`;
}

/** Writes the factory definition to $INPUT and gives the variable that names it. */
export async function factoryOf(sut: Sut, agents: Record<string, AgentOf>): Promise<Record<string, string>> {
  await sut.files.put("$INPUT/factory.yaml", factoryYaml(agents));
  return { CONSOLE_FACTORY: sut.files.path("$INPUT/factory.yaml") };
}

/**
 * Starts a console behind a sign-in proxy with an access file of these people (ada@acme.dev as admin unless named),
 * the factory with these agents and the store; `env` adds or replaces variables.
 */
export async function servingSecrets(
  sut: Sut,
  fakes: Fakes,
  agents: Record<string, AgentOf>,
  options: { people?: Record<string, string>; env?: Record<string, string> } = {},
): Promise<Store> {
  const found = await store(sut, fakes);
  await sut.files.put("$INPUT/access.yaml", accessYaml(options.people));
  const api = await foreman(fakes, []);
  await serving(sut, [api.url], {
    ...(await factoryOf(sut, agents)),
    CONSOLE_USER_HEADER: "X-Forwarded-Email",
    ...found.env,
    ...options.env,
  });
  return found;
}

/** The variables of "console doctor" with a healthy foreman, the factory with these agents and the store. */
export async function doctorEnv(
  sut: Sut,
  fakes: Fakes,
  agents: Record<string, AgentOf>,
  options: { ttl?: string; env?: Record<string, string> } = {},
): Promise<Store> {
  const found = await store(sut, fakes, options.ttl);
  const api = await healthyServer(fakes, [], TOKEN_ROUTES.foreman);
  const env = { CONSOLE_FOREMAN_URL: api.url, ...(await factoryOf(sut, agents)), ...found.env, ...options.env };
  return { bao: found.bao, env };
}

/** The texts of the rows of the list "Secrets", each its name, detail, state and link. */
export const secretRows = (page: Page): string[] =>
  (page.queryByRole("list", { name: "Secrets" })?.queryAllByRole("listitem") ?? []).map((item) => item.text);

/** The text of the row of the secret of this name. */
export const secretRow = (page: Page, name: string): string | undefined =>
  secretRows(page).find((row) => row.startsWith(`${name} `));

/** A time as the page shows a change, like "2026-11-14 20:01 UTC". */
export const TIME = String.raw`\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC`;

/** The form "Store a value" of the page. */
export const storeForm = (page: Page) => page.getByRole("form", { name: "Store a value" });
