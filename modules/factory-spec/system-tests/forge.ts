// The factory "web-app" with a forge automation on the repository "tester/web-app" of fakes.forge, and the
// Forgejo API calls a person makes on its webhooks.
import type { Forge, Sut } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

export const INTAKE = "http://intake.example.invalid/hooks";

export interface ForgeHook {
  id: number;
  config: { url: string };
  events: string[];
  active: boolean;
}

/** The documented variables that point the module at the forge and the intake. */
export const forgeEnv = (forge: Forge): Record<string, string> => ({
  FACTORY_FORGE_URL: forge.url,
  FACTORY_FORGE_TOKEN: forge.token,
  FACTORY_INTAKE_URL: INTAKE,
});

/** Puts factory.yaml with the agent "implement" on "<owner>/web-app" and the automations into $INPUT. */
export async function putFactory(sut: Sut, owner: string, automations: string[]): Promise<void> {
  const rest = automations.length > 0 ? ["automations:", ...automations.map((on) => `  - on: ${on}`)] : [];
  const yaml = factoryYaml({ agents: agent("implement", [`repositories: [${owner}/web-app]`]), rest });
  await sut.files.put("$INPUT/factory.yaml", yaml);
  await sut.files.put("$INPUT/agents/implement.md", prompt("implement"));
}

/** Creates "web-app" in the forge and applies the factory with one label automation to it. */
export async function appliedWithHook(sut: Sut, forge: Forge): Promise<void> {
  await forge.createRepository("web-app");
  await putFactory(sut, forge.owner, ["forgejo.issue.labeled(auto-implement)"]);
  const run = await sut.cli(["apply"], { env: forgeEnv(forge) });
  expect(run.exitCode, run.stderr).toBe(0);
}

/** A call to the forge's API as its user, for example a person editing a webhook. */
export async function forgeApi(forge: Forge, method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${forge.url}/api/v1/repos/${forge.owner}/web-app${path}`, {
    method,
    headers: { authorization: `token ${forge.token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  expect(response.ok, `${method} ${path}: ${response.status}`).toBe(true);
  return response.status === 204 ? undefined : response.json();
}

export const hooks = (forge: Forge): Promise<ForgeHook[]> => forgeApi(forge, "GET", "/hooks") as Promise<ForgeHook[]>;
