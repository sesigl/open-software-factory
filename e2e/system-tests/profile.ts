// The factory of a smoke scenario on the Compose profile (ADR 0076): the e2e factory with the scenario's factory.yaml
// in $INPUT/factory, the fake Slack and the scripted agent for containers, and the profile's .env with every value set.
import type { RunView } from "@opensoftware/contracts";
import type { Compose, FakeSlack, Fakes, Forge, Harness, HarnessTurn, Sut } from "@opensoftware/testkit";

/** The values of .env that osf init generates for the profile's OpenBao (ADR 0145), made up for the tests. */
const OPENBAO: Record<string, string> = {
  OSF_OPENBAO_UNSEAL_KEY: "0e".repeat(32),
  OSF_OPENBAO_ROOT_TOKEN: "a1".repeat(32),
  OSF_OPENBAO_CONSOLE_TOKEN: "c2".repeat(32),
  OSF_OPENBAO_EGRESS_TOKEN: "e3".repeat(32),
};

export const FOREMAN_TOKEN = "foreman-token-1";
export const INTAKE_TOKEN = "intake-token-1";
export const GATEKEEPER_TOKEN = "gatekeeper-token-1";
/** The channel where people ask for work, and the one where gatekeeper asks for approvals. */
export const REQUESTS = "C0WORK";
export const GATES = "C0GATES";
/** A member of "maintainers" in the e2e factory's groups.json. */
export const MAINTAINER = "U0ADA";
export const WEBHOOK_SECRET = "whsec-e2e-1";
/** The master key of the LLM gateway. */
export const LITELLM_KEY = "sk-litellm-master-1";
/** How long a scenario waits for the factory to move; a run takes seconds. */
export const WAIT_MS = 120_000;

/** The work item of the README of foreman, as intake publishes it. */
export const WORK = {
  id: "wi_5d1c1f0a9e7b3c2d4e6f",
  type: "idea",
  title: "Export reports as CSV",
  requester: { kind: "person", id: "slack:U0PERSON", displayName: "Varun" },
  origin: { source: "api" },
  dedupeKey: "idea:export-csv",
};

/**
 * factory.yaml of the e2e factory with an agent and a stage for each name; the stage "spec" waits for the gate of
 * "maintainers". The agents run on the harness `acp`, which foreman starts as the scripted agent, or on `harness`.
 * `providers` and `agent` add lines below `providers:` and to each agent; `agents` adds lines below the agents, like
 * an agent of no stage; `tail` adds lines at the end.
 */
export function factoryYaml(
  stages: string[],
  more: { harness?: string; providers?: string[]; agent?: string[]; agents?: string[]; tail?: string[] } = {},
): string {
  const harness = more.harness ?? "acp";
  return [
    "version: 1",
    "factory: smoke",
    "providers:",
    "  harness:",
    `    ${harness}: "^0"`,
    ...(more.providers ?? []).map((line) => `  ${line}`),
    "agents:",
    ...stages.flatMap((stage) => [
      `  ${stage}:`,
      `    harness: ${harness}`,
      `    model: routes/${stage}`,
      "    effort: medium",
      `    prompt: ./agents/${stage}.md`,
      ...(more.agent ?? []).map((line) => `    ${line}`),
    ]),
    ...(more.agents ?? []).map((line) => `  ${line}`),
    "workflow:",
    ...stages.flatMap((stage) =>
      stage === "spec"
        ? ["  - stage: spec", "    gate:", "      policy: ./policy/spec.rego", "      approvers: [maintainers]"]
        : [`  - stage: ${stage}`],
    ),
    ...(more.tail ?? []),
    "",
  ].join("\n");
}

/** Where a container reaches a URL of the Docker host. */
export const fromContainer = (url: string): string =>
  url.replace(/\/\/(localhost|127\.0\.0\.1):/, "//host.docker.internal:");

/** The scenario's folder that the tools of the profile see as /work; they run as the scenario's user. */
export async function workFolder(sut: Sut, files: Record<string, string>): Promise<string> {
  for (const [path, content] of Object.entries(files)) await sut.files.put(`$INPUT/work/${path}`, content);
  return sut.files.path("$INPUT/work");
}

export interface Smoke {
  compose: Compose;
  slack: FakeSlack;
  harness: Harness;
  /** Runs `docker compose <words>` and fails the scenario when it does not exit with 0. */
  run(words: string[]): Promise<string>;
  /** The base URL where the project publishes the API port of the service. */
  url(service: "foreman" | "intake" | "gatekeeper" | "litellm"): Promise<string>;
  /**
   * Polls `read` until it gives `expected`. On a timeout, the error shows the last lines of the modules' logs, since the
   * project is gone after the scenario.
   */
  until<T>(read: () => Promise<T> | T, expected: T): Promise<void>;
}

/** Where the workspace image holds the scripted agent, for the sandboxes that start from it (ADR 0096). */
export const SANDBOX_AGENT = "/opt/osf/harness-agent.ts";

/**
 * Writes the e2e factory with `factory` as its factory.yaml and the profile's .env, with the fake Slack and the scripted
 * agent with `turns`. The forge, when given, is the one the factory's tools reach. `more` adds E2E_ values to .env.
 * With `sandboxes`, the agents run in sandboxes of the workspace image, which reach the testkit and the forge at
 * host.docker.internal; foreman then mounts no folder of the agent.
 */
export async function smoke(
  sut: Sut,
  fakes: Fakes,
  factory: string,
  turns: HarnessTurn[] = [],
  forge?: Forge,
  more: Record<string, string> = {},
  options: { sandboxes?: boolean } = {},
): Promise<Smoke> {
  for (const [path, content] of Object.entries(fakes.fromRepository("e2e/factory")))
    await sut.files.put(`$INPUT/factory/${path}`, content);
  await sut.files.put("$INPUT/factory/factory.yaml", factory);
  // The LLM gateway's config of the profile, unless the scenario gives its own.
  const [litellm] = Object.values(fakes.fromRepository("deploy/compose/litellm"));
  await sut.files.put("$INPUT/litellm/config.yaml", litellm as string);
  const slack = await fakes.slack({ containers: true });
  const harness = await fakes.harness(
    turns,
    options.sandboxes ? { sandboxes: { agent: SANDBOX_AGENT } } : { containers: true },
  );
  await sut.files.put("$INPUT/no-agent/.keep", "");
  const none = sut.files.path("$INPUT/no-agent");
  const [agentDir, harnessDir] = (harness.mounts ?? [none, none]) as [string, string];
  const values: Record<string, string> = {
    POSTGRES_PASSWORD: "postgres-password-1",
    LITELLM_MASTER_KEY: LITELLM_KEY,
    FOREMAN_API_TOKEN: FOREMAN_TOKEN,
    INTAKE_API_TOKEN: INTAKE_TOKEN,
    GATEKEEPER_API_TOKEN: GATEKEEPER_TOKEN,
    GATEKEEPER_SLACK_TOKEN: slack.token,
    GATEKEEPER_SLACK_SIGNING_SECRET: slack.signingSecret,
    GATEKEEPER_SLACK_CHANNEL: GATES,
    ...OPENBAO,
    FACTORY_DIR: sut.files.path("$INPUT/factory"),
    E2E_SLACK_URL: slack.containerUrl as string,
    E2E_HARNESSES: JSON.stringify({ acp: ["harness-acp", "run", "--", harness.command, ...harness.args].join(" ") }),
    E2E_AGENT_DIR: agentDir,
    E2E_HARNESS_DIR: harnessDir,
    ...(forge ? { E2E_FORGE_URL: fromContainer(forge.url), E2E_FORGE_TOKEN: forge.token } : {}),
    E2E_WEBHOOK_SECRET: WEBHOOK_SECRET,
    E2E_USER: `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    E2E_LITELLM_CONFIG: sut.files.path("$INPUT/litellm/config.yaml"),
    ...more,
  };
  // Port 0 lets Docker pick free ports, so scenarios that run side by side do not collide.
  // A scenario may name a port in `more`, like the console's, whose address the sign-in needs before the start.
  const ports = ["CONSOLE_PORT", "INTAKE_PORT", "GATEKEEPER_PORT", "FOREMAN_PORT", "TEMPORAL_UI_PORT", "JAEGER_PORT"];
  const free = [...ports, "LITELLM_PORT"].filter((name) => !(name in more));
  const lines = [...Object.entries(values), ...free.map((name) => [name, "0"])];
  await sut.files.put("$INPUT/.env", `${lines.map(([name, value]) => `${name}=${value}`).join("\n")}\n`);
  const compose = sut.compose("compose/compose.yaml");
  return {
    compose,
    slack,
    harness,
    async run(words) {
      const result = await compose.run(words);
      expect(result.exitCode, `docker compose ${words.join(" ")}:\n${result.stdout}${result.stderr}`).toBe(0);
      return result.stdout;
    },
    url: (service) => compose.url(service, service === "litellm" ? 4000 : 8080),
    async until(read, expected) {
      try {
        await expect.poll(read, { timeout: WAIT_MS, interval: 500 }).toEqual(expected);
      } catch (error) {
        const modules = ["gatekeeper", "intake", "foreman"];
        const logs = await compose.run(["logs", "--no-color", "--tail", "40", ...modules]);
        throw new Error(`${(error as Error).message}\n${logs.stdout}${logs.stderr}`);
      }
    },
  };
}

/** Starts the services and points the fake Slack at intake's events and gatekeeper's buttons. */
export async function started(smokeProfile: Smoke, services: string[]): Promise<void> {
  const up = ["up", "--detach", "--wait", ...services];
  // Port 0 lets Docker pick a free port, and a scenario beside this one may take that port in the same moment: Docker
  // then says "address already in use". "up" again starts what did not start, with a port Docker picks anew.
  const first = await smokeProfile.compose.run(up);
  if (first.exitCode !== 0 && !(first.stdout + first.stderr).includes("address already in use"))
    expect(first.exitCode, `docker compose ${up.join(" ")}:\n${first.stdout}${first.stderr}`).toBe(0);
  if (first.exitCode !== 0) await smokeProfile.run(up);
  const intake = await smokeProfile.url("intake").catch(() => undefined);
  const gatekeeper = await smokeProfile.url("gatekeeper").catch(() => undefined);
  smokeProfile.slack.deliverTo(
    intake ? `${intake}/slack/events` : `${gatekeeper}/slack/events`,
    gatekeeper && `${gatekeeper}/slack/actions`,
  );
}

/** Calls a module's API with its token. */
export async function api(
  base: string,
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: unknown }> {
  const answer = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await answer.text();
  return { status: answer.status, body: text ? JSON.parse(text) : undefined };
}

/** Posts a work item to foreman's "/v1/runs" with the API token, as a program does, and gives the run's ID. */
export async function postRun(foreman: string, work: typeof WORK): Promise<string> {
  const answer = await api(foreman, FOREMAN_TOKEN, "/v1/runs", { method: "POST", body: work });
  expect(answer.status, JSON.stringify(answer.body)).toBe(201);
  return (answer.body as RunView).runId;
}

/** The run as foreman's API shows it. */
export const runView = async (foreman: string, runId: string): Promise<RunView> =>
  (await api(foreman, FOREMAN_TOKEN, `/v1/runs/${runId}`)).body as RunView;

/** The stage "implement" of the run, as foreman's API shows it. */
export const implementOf = async (foreman: string, runId: string) =>
  (await runView(foreman, runId)).stages.find((candidate) => candidate.stage === "implement");

/** The factory's access file: "ada@acme.dev" is its admin and "grace@acme.dev" its factory engineer. */
export const ACCESS = [
  "version: 1",
  "people:",
  "  - email: ada@acme.dev",
  "    role: admin",
  "  - email: grace@acme.dev",
  "    role: factory-engineer",
  "",
].join("\n");

/** One answer of the console to a browser that follows no redirect. */
export interface Answer {
  status: number;
  location: string;
  html: string;
}

/** Opens a path of the console, or sends a form to it when `form` is given. */
export type Browser = (path: string, form?: Record<string, string>) => Promise<Answer>;

/**
 * A browser without script: it keeps the console's cookies and follows no redirect, so each step sees one answer.
 * A form names the console's own address `origin` in Origin, as a browser does (ADR 0134).
 */
export function browser(base: string, origin: string): Browser {
  const jar = new Map<string, string>();
  return async (path, form) => {
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await fetch(new URL(path, base), {
      method: form ? "POST" : "GET",
      redirect: "manual",
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(form ? { origin, "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    for (const line of response.headers.getSetCookie()) {
      const [name, value] = (line.split(";")[0] ?? "").split("=", 2) as [string, string];
      if (value) jar.set(name, value);
      else jar.delete(name);
    }
    return { status: response.status, location: response.headers.get("location") ?? "", html: await response.text() };
  };
}

/**
 * The console's own sign-in with GitHub (ADR 0134) on this port of localhost: a fake GitHub's token exchange and API,
 * as the console calls them from its container, for "grace@acme.dev". `env` holds the values of .env; the console's
 * address names its port before it starts, so the port cannot be 0. `signIn` signs her in as a person does who
 * consents in the browser, and gives the browser with her session.
 */
export async function githubSignIn(fakes: Fakes, port: string) {
  const github = await fakes.http(
    [
      { method: "POST", path: "/login/oauth/access_token", body: { access_token: "gho_grace" } },
      { path: "/user", body: { login: "grace", name: "Grace" } },
      { path: "/user/emails", body: [{ email: "grace@acme.dev", primary: true, verified: true }] },
    ],
    { containers: true },
  );
  const env: Record<string, string> = {
    CONSOLE_PORT: port,
    CONSOLE_SIGN_IN: "github",
    // The OAuth app of the operator, made up for the test: no GitHub issued it.
    CONSOLE_GITHUB_CLIENT_ID: "Iv1.acme0console",
    CONSOLE_GITHUB_CLIENT_SECRET: "github-oauth-secret-1",
    CONSOLE_SESSION_SECRET: "console-session-secret-1",
    E2E_GITHUB_URL: github.containerUrl as string,
  };
  return {
    env,
    async signIn(profile: Smoke, next: string): Promise<Browser> {
      // The person opens the console on localhost, CONSOLE_URL's host, where the profile publishes its port.
      const base = (await profile.compose.url("console", 8080)).replace("127.0.0.1", "localhost");
      const open = browser(base, `http://localhost:${port}`);
      const authorize = new URL((await open(`/signin/start?next=${encodeURIComponent(next)}`)).location);
      // GitHub's answer after the person consents: back to the callback with a code and the sign-in's state.
      const callback = new URL(authorize.searchParams.get("redirect_uri") ?? "");
      callback.searchParams.set("code", "github-code-grace");
      callback.searchParams.set("state", authorize.searchParams.get("state") ?? "");
      const signedIn = await open(callback.pathname + callback.search);
      expect({ status: signedIn.status, location: signedIn.location }).toEqual({ status: 303, location: next });
      return open;
    },
  };
}

/** Calls Forgejo's API on the repository "factory" as its owner, as a person or the factory's workflow would. */
export async function factoryApi(forge: Forge, method: string, path: string, body?: unknown): Promise<unknown> {
  const answer = await fetch(`${forge.url}/api/v1/repos/${forge.owner}/factory${path}`, {
    method,
    headers: { authorization: `token ${forge.token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!answer.ok) throw new Error(`the forge answered ${method} ${path} with ${answer.status}: ${await answer.text()}`);
  return answer.json();
}

/**
 * The factory's repository "factory" on the forge (ADR 0150): the e2e factory with this factory.yaml, ACCESS and the
 * files; its main branch requires the check "factory" and no approval, as the console asks (ADR 0144). Gives the
 * values of .env that point the profile at it, with the forge's token and its user, as the containers reach the forge.
 */
export async function factoryRepository(
  fakes: Fakes,
  forge: Forge,
  factory: string,
  files: Record<string, string> = {},
): Promise<Record<string, string>> {
  const e2e = fakes.fromRepository("e2e/factory");
  await forge.createRepository("factory", { ...e2e, "factory.yaml": factory, "access.yaml": ACCESS, ...files });
  const rule = {
    rule_name: "main",
    enable_status_check: true,
    status_check_contexts: ["factory"],
    required_approvals: 0,
  };
  await factoryApi(forge, "POST", "/branch_protections", rule);
  const server = fromContainer(forge.url);
  return {
    FACTORY_REPOSITORY: `git+${server}/${forge.owner}/factory.git#main`,
    FACTORY_TOKEN: forge.token,
    FACTORY_USER: `forgejo:${forge.owner}`,
    FACTORY_FORGE_ADAPTER: "forge-forgejo",
    FACTORY_FORGE_URL: server,
  };
}

/** The head commit of "main" of the repository "factory". */
export const mainOf = async (forge: Forge): Promise<string | undefined> =>
  (await forge.branches("factory")).find((branch) => branch.name === "main")?.sha;

/**
 * Posts the check "factory" with "success" on the head of the newest pull request, as the factory's workflow posts it
 * (ADR 0150): nothing in the profile runs that workflow.
 */
export async function passCheck(forge: Forge): Promise<void> {
  const [pull] = await forge.pullRequests("factory");
  const head = (await forge.branches("factory")).find((branch) => branch.name === pull?.head)?.sha;
  await factoryApi(forge, "POST", `/statuses/${head}`, { context: "factory", state: "success" });
}

/** A pull request of the repository "factory" as Forgejo's API gives it. */
export interface PullOfForge {
  number: number;
  merged: boolean;
  merge_commit_sha: string;
  merged_by: { login: string } | null;
}

/** Waits until Forgejo merged the newest pull request in the background, once its check passed, and gives it. */
export async function merged(forge: Forge): Promise<PullOfForge> {
  const state = async () => (await forge.pullRequests("factory"))[0]?.state;
  await expect.poll(state, { timeout: WAIT_MS, interval: 500 }).toBe("closed");
  const [pull] = await forge.pullRequests("factory");
  return (await factoryApi(forge, "GET", `/pulls/${pull?.number}`)) as PullOfForge;
}
