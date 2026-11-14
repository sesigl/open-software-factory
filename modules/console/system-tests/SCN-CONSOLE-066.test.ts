import { scenario } from "@opensoftware/testkit";
import { factoryEnv } from "./console.ts";

scenario("SCN-CONSOLE-066", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('the factory definition with the agent "triage" on the route "routes/triage"', async () => {
    env = await factoryEnv(sut);
  });

  let gateway: Awaited<ReturnType<typeof fakes.modelGateway>>;
  await given('a model gateway in "CONSOLE_MODEL_URL"', async () => {
    gateway = await fakes.modelGateway([]);
    env = { ...env, CONSOLE_MODEL_URL: gateway.url, CONSOLE_HARNESS_COMMAND: "true" };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("it prints no line about a model route or the harness", async () => {
    expect(run.stdout).toContain("factory\n");
    expect(run.stdout).not.toMatch(/model|harness/);
  });

  await then("the gateway received no call", async () => {
    expect(gateway.calls).toHaveLength(0);
  });
});
