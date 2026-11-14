import { scenario } from "@opensoftware/testkit";
import { factoryEnv, open, rows, serving } from "./console.ts";

scenario("SCN-CONSOLE-069", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('the factory definition with the agent "triage" on the route "routes/triage"', async () => {
    env = await factoryEnv(sut);
  });

  let gateway: Awaited<ReturnType<typeof fakes.modelGateway>>;
  await given('a model gateway in "CONSOLE_MODEL_URL"', async () => {
    gateway = await fakes.modelGateway([]);
    env = { ...env, CONSOLE_MODEL_URL: gateway.url, CONSOLE_HARNESS_COMMAND: "true" };
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/health"', async () => {
    await serving(sut, ["http://127.0.0.1:1"], env);
    page = await open(sut, "/health");
  });

  await then("its table has no row about a model route or the harness", async () => {
    const names = rows(page).map(([name]) => name);
    expect(names).toContain("factory");
    expect(names.filter((name) => /model|harness/.test(name ?? ""))).toEqual([]);
  });

  await then("the gateway received no call", async () => {
    expect(gateway.calls).toHaveLength(0);
  });
});
