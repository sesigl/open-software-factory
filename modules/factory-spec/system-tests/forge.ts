// The forge side of the webhook scenarios: a factory whose agent operates on a Forgejo or GitHub repository, the
// module's forge configuration with the forge port's adapter, and the webhooks as the forge reports them.
import type { Forge, Sut } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

export const INTAKE = "http://intake.example/webhooks/forge";

export const SECRET = "whsec-7f3a";

/**
 * factory.yaml whose agent "triage" operates on <owner>/web, with the automation
 * "<source>.issue.labeled(auto-implement)" when `automation` is set.
 */
export async function putForgeFactory(sut: Sut, owner: string, automation = true, source = "forgejo"): Promise<void> {
  const rest = automation ? ["automations:", `  - on: ${source}.issue.labeled(auto-implement)`] : [];
  const yaml = factoryYaml({
    providers: ["harness:", '  claude-code: "^2"', "forge:", `  ${source}: "^1"`],
    agents: agent("triage", [`repositories: [${owner}/web]`]),
    rest,
  });
  await sut.files.put("$INPUT/factory.yaml", yaml);
  await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
}

/** The documented configuration that points the module at the Forgejo, its adapter and intake. */
export const forgeEnv = (sut: Sut, forge: Forge, token = forge.token): Record<string, string> => ({
  FACTORY_FORGE_URL: forge.url,
  FACTORY_FORGE_TOKEN: token,
  FACTORY_FORGEJO_ADAPTER: sut.adapter("forge/forgejo"),
  FACTORY_INTAKE_URL: INTAKE,
  FACTORY_WEBHOOK_SECRET: SECRET,
});

/** The documented configuration that points the module at the fake GitHub, its adapter and intake. */
export const githubEnv = (sut: Sut, github: Forge): Record<string, string> => ({
  FACTORY_GITHUB_URL: github.url,
  FACTORY_GITHUB_TOKEN: github.token,
  FACTORY_GITHUB_ADAPTER: sut.adapter("forge/github"),
  FACTORY_INTAKE_URL: INTAKE,
  FACTORY_WEBHOOK_SECRET: SECRET,
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
  const run = await sut.cli(["apply"], { env: forgeEnv(sut, forge) });
  expect(run.exitCode, run.stderr).toBe(0);
}

async function githubApi(github: Forge, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${github.url}/repos/${github.owner}/web${path}`, {
    method,
    headers: { authorization: `Bearer ${github.token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** A person changes the URL of the only webhook of <owner>/web on GitHub. */
export async function changeGitHubHookUrl(github: Forge, url: string): Promise<void> {
  const [hook] = (await (await githubApi(github, "GET", "/hooks")).json()) as { id: number }[];
  await githubApi(github, "PATCH", `/hooks/${hook?.id}`, { config: { url } });
}

/** The factory was applied with its webhook on <owner>/web on GitHub. */
export async function appliedWithGitHubHook(sut: Sut, github: Forge): Promise<void> {
  await github.createRepository("web");
  await putForgeFactory(sut, github.owner, true, "github");
  const run = await sut.cli(["apply"], { env: githubEnv(sut, github) });
  expect(run.exitCode, run.stderr).toBe(0);
}
