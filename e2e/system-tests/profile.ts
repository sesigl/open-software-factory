// The factory of a smoke scenario on the Compose profile (ADR 0076): the e2e factory with the scenario's factory.yaml
// in $INPUT/factory, the fake Slack and the scripted agent for containers, and the profile's .env with every value set.
import { chmodSync } from "node:fs";
import type { Compose, FakeSlack, Fakes, Forge, Harness, HarnessTurn, Sut } from "@opensoftware/testkit";

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
 * `providers` and `agent` add lines below `providers:` and to each agent; `tail` adds lines at the end.
 */
export function factoryYaml(
  stages: string[],
  more: { harness?: string; providers?: string[]; agent?: string[]; tail?: string[] } = {},
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
      `    prompt: ./agents/${stage}.md`,
      ...(more.agent ?? []).map((line) => `    ${line}`),
    ]),
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

/** The scenario's folder that the tools of the profile see as /work; their user may write it. */
export async function workFolder(sut: Sut, files: Record<string, string>): Promise<string> {
  for (const [path, content] of Object.entries(files)) await sut.files.put(`$INPUT/work/${path}`, content);
  const folder = sut.files.path("$INPUT/work");
  chmodSync(folder, 0o777);
  return folder;
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

/**
 * Writes the e2e factory with `factory` as its factory.yaml and the profile's .env, with the fake Slack and the scripted
 * agent with `turns`. The forge, when given, is the one the factory's tools reach. `more` adds E2E_ values to .env.
 */
export async function smoke(
  sut: Sut,
  fakes: Fakes,
  factory: string,
  turns: HarnessTurn[] = [],
  forge?: Forge,
  more: Record<string, string> = {},
): Promise<Smoke> {
  for (const [path, content] of Object.entries(fakes.fromRepository("e2e/factory")))
    await sut.files.put(`$INPUT/factory/${path}`, content);
  await sut.files.put("$INPUT/factory/factory.yaml", factory);
  // The LLM gateway's config of the profile, unless the scenario gives its own.
  const [litellm] = Object.values(fakes.fromRepository("deploy/compose/litellm"));
  await sut.files.put("$INPUT/litellm/config.yaml", litellm as string);
  const slack = await fakes.slack({ containers: true });
  const harness = await fakes.harness(turns, { containers: true });
  const [agentDir, harnessDir] = harness.mounts as [string, string];
  const values: Record<string, string> = {
    POSTGRES_PASSWORD: "postgres-password-1",
    LITELLM_MASTER_KEY: LITELLM_KEY,
    FOREMAN_API_TOKEN: FOREMAN_TOKEN,
    INTAKE_API_TOKEN: INTAKE_TOKEN,
    GATEKEEPER_API_TOKEN: GATEKEEPER_TOKEN,
    GATEKEEPER_SLACK_TOKEN: slack.token,
    GATEKEEPER_SLACK_SIGNING_SECRET: slack.signingSecret,
    GATEKEEPER_SLACK_CHANNEL: GATES,
    FACTORY_DIR: sut.files.path("$INPUT/factory"),
    E2E_SLACK_URL: slack.containerUrl as string,
    E2E_HARNESSES: JSON.stringify({ acp: ["harness-acp", "run", "--", harness.command, ...harness.args].join(" ") }),
    E2E_AGENT_DIR: agentDir,
    E2E_HARNESS_DIR: harnessDir,
    ...(forge ? { E2E_FORGE_URL: fromContainer(forge.url), E2E_FORGE_TOKEN: forge.token } : {}),
    E2E_WEBHOOK_SECRET: WEBHOOK_SECRET,
    E2E_LITELLM_CONFIG: sut.files.path("$INPUT/litellm/config.yaml"),
    ...more,
  };
  // Port 0 lets Docker pick free ports, so scenarios that run side by side do not collide.
  const ports = ["CONSOLE_PORT", "INTAKE_PORT", "GATEKEEPER_PORT", "FOREMAN_PORT", "TEMPORAL_UI_PORT", "PHOENIX_PORT"];
  const lines = [...Object.entries(values), ...[...ports, "LITELLM_PORT"].map((name) => [name, "0"])];
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
  await smokeProfile.run(["up", "--detach", "--wait", ...services]);
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
