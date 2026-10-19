// The forge side of the webhook scenarios: a factory whose agent operates on a Forgejo repository, the module's
// forge configuration, and the webhooks as Forgejo reports them.
import type { Forge, Sut } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

export const INTAKE = "http://intake.example/webhooks/forge";

/** factory.yaml whose agent "triage" operates on <owner>/web, with the automation when `automation` is set. */
export async function putForgeFactory(sut: Sut, owner: string, automation = true): Promise<void> {
  const rest = automation ? ["automations:", "  - on: forgejo.issue.labeled(auto-implement)"] : [];
  const yaml = factoryYaml({
    providers: ["harness:", '  claude-code: "^2"', "forge:", '  forgejo: "^1"'],
    agents: agent("triage", [`repositories: [${owner}/web]`]),
    rest,
  });
  await sut.files.put("$INPUT/factory.yaml", yaml);
  await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
}

/** The documented configuration that points the module at the forge and at intake. */
export const forgeEnv = (forge: Forge, token = forge.token): Record<string, string> => ({
  FACTORY_FORGE_URL: forge.url,
  FACTORY_FORGE_TOKEN: token,
  FACTORY_INTAKE_URL: INTAKE,
});

export interface ForgeHook {
  id: number;
  url: string;
  events: string[];
}

async function api(forge: Forge, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${forge.url}/api/v1/repos/${forge.owner}/web${path}`, {
    method,
    headers: { authorization: `token ${forge.token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** The webhooks of <owner>/web as Forgejo lists them. */
export async function hooksOf(forge: Forge): Promise<ForgeHook[]> {
  const list = (await (await api(forge, "GET", "/hooks")).json()) as {
    id: number;
    config: { url: string };
    events: string[];
  }[];
  return list.map((hook) => ({ id: hook.id, url: hook.config.url, events: hook.events }));
}

/** A person changes the URL of the only webhook of <owner>/web in Forgejo. */
export async function changeHookUrl(forge: Forge, url: string): Promise<void> {
  const [hook] = await hooksOf(forge);
  await api(forge, "PATCH", `/hooks/${hook?.id}`, {
    config: { url, content_type: "json" },
    events: hook?.events,
    active: true,
  });
}

/** A person deletes the only webhook of <owner>/web in Forgejo. */
export async function deleteHook(forge: Forge): Promise<void> {
  const [hook] = await hooksOf(forge);
  await api(forge, "DELETE", `/hooks/${hook?.id}`);
}

/** The factory was applied with its webhook on <owner>/web. */
export async function appliedWithHook(sut: Sut, forge: Forge): Promise<void> {
  await forge.createRepository("web");
  await putForgeFactory(sut, forge.owner);
  const run = await sut.cli(["apply"], { env: forgeEnv(forge) });
  expect(run.exitCode, run.stderr).toBe(0);
}
