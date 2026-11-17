// The Compose profile as the operator sets it up: every value of compose/.env.example set in $INPUT/.env.
import type { CliResult, Compose, Fakes, Shared, SharedSut, Sut } from "@opensoftware/testkit";

/**
 * The values of .env that osf init generates for the profile's OpenBao (ADR 0145): 64 hex digits each, made up for
 * the tests. Each scenario's project has a volume of its own, so the same key opens no other store.
 */
export const OPENBAO: Record<string, string> = {
  OSF_OPENBAO_UNSEAL_KEY: "0e".repeat(32),
  OSF_OPENBAO_ROOT_TOKEN: "a1".repeat(32),
  OSF_OPENBAO_CONSOLE_TOKEN: "c2".repeat(32),
  OSF_OPENBAO_EGRESS_TOKEN: "e3".repeat(32),
};

/**
 * The console's sign-in with GitHub and its signing key (ADR 0151), made up for the tests: no GitHub issued the app,
 * and the key is the seed the console's own tests use.
 */
export const SIGN_IN = {
  CONSOLE_SIGN_IN: "github",
  CONSOLE_SESSION_SECRET: "console-session-secret-1",
  CONSOLE_GITHUB_CLIENT_ID: "Iv1.acme0console",
  CONSOLE_GITHUB_CLIENT_SECRET: "github-oauth-secret-1",
  CONSOLE_SIGNING_KEY: "0123456789abcdef".repeat(4),
};

/** The values of `.env.example`, made up for the tests. */
const VALUES: Record<string, string> = {
  ...OPENBAO,
  POSTGRES_PASSWORD: "postgres-password-1",
  LITELLM_MASTER_KEY: "sk-litellm-master-1",
  FOREMAN_API_TOKEN: "foreman-token-1",
  INTAKE_API_TOKEN: "intake-token-1",
  GATEKEEPER_API_TOKEN: "gatekeeper-token-1",
  GATEKEEPER_SLACK_TOKEN: "xoxb-gatekeeper-1",
  GATEKEEPER_SLACK_SIGNING_SECRET: "slack-signing-secret-1",
  GATEKEEPER_SLACK_CHANNEL: "C0GATES",
};

// Port 0 lets Docker pick free ports, so scenarios that run side by side do not collide.
const PORTS = [
  "CONSOLE_PORT",
  "INTAKE_PORT",
  "GATEKEEPER_PORT",
  "FOREMAN_PORT",
  "TEMPORAL_UI_PORT",
  "JAEGER_PORT",
  "LITELLM_PORT",
];

/** Writes `.env` without the value `except` and with the values `more`, a port among them, and returns the profile. */
export async function profile(sut: SharedSut, except?: string, more: Record<string, string> = {}): Promise<Compose> {
  const lines = Object.entries({ ...VALUES, ...more })
    .filter(([name]) => name !== except)
    .map(([name, value]) => `${name}=${value}`);
  const ports = PORTS.filter((name) => !(name in more)).map((name) => `${name}=0`);
  await sut.files.put("$INPUT/.env", [...lines, ...ports, ""].join("\n"));
  return sut.compose("compose/compose.yaml");
}

/**
 * The one start of the profile for the scenarios tagged `@shared=compose-profile`, which only read it (ADR 0157): every
 * value of `.env.example` set in `.env`, with FACTORY_DIR the operator's copy of the reference factory, which names a
 * real approver (ADR 0114), and then "docker compose up --detach --wait". Its result is that command's.
 */
export function sharedProfile(sut: Sut, fakes: Fakes): Promise<Shared<CliResult>> {
  return sut.shared("compose-profile", async (start) => {
    const compose = await profile(start, undefined, { FACTORY_DIR: await operatorFactory(start, fakes) });
    const up = await compose.run(words("docker compose up --detach --wait"));
    if (up.exitCode !== 0) {
      throw new Error(`"docker compose up --detach --wait" exited with code ${up.exitCode}: ${up.stderr}`);
    }
    return up;
  });
}

/** The words after "docker compose" in a step like 'the operator runs "docker compose up --detach --wait"'. */
export function words(command: string): string[] {
  return command.replace(/^docker compose /, "").split(" ");
}

/** A stage of the factory that "factory resolve" printed; the first build of the image prints its log before the JSON. */
export function stageOf(stdout: string, name: string): Record<string, unknown> | undefined {
  const factory = JSON.parse(stdout.slice(stdout.search(/^\{$/m))) as { workflow: { stage: string }[] };
  return factory.workflow.find((stage) => stage.stage === name);
}

/** The example of each file of the reference factory, and the person an operator puts in its place. */
const OPERATOR: Record<string, [string, string]> = {
  "groups.json": ["slack:U0EXAMPLE", "slack:U0OPERATOR"],
  "access.yaml": ["admin@example.com", "ada@acme.dev"],
};

/**
 * The reference factory as an operator sets it up after the quick start, for FACTORY_DIR: a copy whose group
 * "maintainers" names a person in place of the example's member slack:U0EXAMPLE (ADR 0114), and whose access.yaml
 * names the admin ada@acme.dev in place of the example's admin@example.com (ADR 0134). Returns its path.
 */
export async function operatorFactory(sut: SharedSut, fakes: Fakes): Promise<string> {
  const files = fakes.fromRepository("deploy/compose/factory");
  for (const [path, text] of Object.entries(files)) {
    const [example, person] = OPERATOR[path] ?? ["", ""];
    const content = example ? text.replaceAll(example, person) : text;
    await sut.files.put(`$INPUT/factory/${path}`, content);
  }
  return sut.files.path("$INPUT/factory");
}
