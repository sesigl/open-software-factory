import { scenario } from "@opensoftware/testkit";
import { factoryEnv, healthyServer, TOKEN_ROUTES } from "./console.ts";

scenario("SCN-CONSOLE-064", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a foreman whose "/v1/health" is ok and that accepts its token', async () => {
    const foreman = await healthyServer(fakes, [{ name: "temporal", ok: true }], TOKEN_ROUTES.foreman);
    env = { CONSOLE_FOREMAN_URL: foreman.url, CONSOLE_FOREMAN_TOKEN: "foreman-token" };
  });

  await given('the factory definition with the agent "triage" on the route "routes/triage"', async () => {
    env = { ...env, ...(await factoryEnv(sut)) };
  });

  let gateway: Awaited<ReturnType<typeof fakes.modelGateway>>;
  await given('a model gateway in "CONSOLE_MODEL_URL" that answers a call to "routes/triage"', async () => {
    gateway = await fakes.modelGateway([{ when: '"model":"routes/triage"', reply: "pong" }]);
    env = { ...env, CONSOLE_MODEL_URL: gateway.url, CONSOLE_MODEL_TOKEN: "gateway-key" };
  });

  await given('a harness in "CONSOLE_HARNESS_COMMAND" that speaks ACP', async () => {
    const harness = await fakes.harness([]);
    const quoted = [harness.command, ...harness.args].map((part) => `'${part}'`).join(" ");
    env = { ...env, CONSOLE_HARNESS_COMMAND: quoted };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('it prints "ok    model routes/triage" and "ok    harness"', async () => {
    expect(run.stdout).toContain("ok    model routes/triage\nok    harness\n");
  });

  await then('the gateway received one call, for the model "routes/triage"', async () => {
    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0]?.path).toBe("/v1/chat/completions");
    expect(JSON.parse(gateway.calls[0]?.body ?? "{}")).toMatchObject({ model: "routes/triage", max_tokens: 1 });
    expect(gateway.calls[0]?.headers.authorization).toBe("Bearer gateway-key");
    expect(gateway.calls[0]?.headers["content-type"]).toBe("application/json");
  });
});
