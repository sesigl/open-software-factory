import { scenario } from "@opensoftware/testkit";
import { factoryEnv } from "./console.ts";

scenario("SCN-CONSOLE-065", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('the factory definition with the agent "triage" on the route "routes/triage"', async () => {
    env = await factoryEnv(sut);
  });

  await given('a model gateway in "CONSOLE_MODEL_URL" that answers 500 to every call', async () => {
    const gateway = await fakes.http([
      { method: "POST", path: "/v1/chat/completions", status: 500, body: { error: { message: "no provider" } } },
    ]);
    env = { ...env, CONSOLE_MODEL_URL: `${gateway.url}/v1` };
  });

  await given('"CONSOLE_HARNESS_COMMAND" is a command that answers ACP initialize with an error', async () => {
    const error = { jsonrpc: "2.0", id: 1, error: { code: -32603, message: "no key" } };
    env = { ...env, CONSOLE_HARNESS_COMMAND: `echo '${JSON.stringify(error)}'` };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  model routes/triage: the gateway answered 500: check the route in the gateway\'s config and its provider key"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  model routes/triage: the gateway answered 500: check the route in the gateway's config and its provider key\n",
      );
    },
  );

  await then('it prints "FAIL  harness: it did not answer ACP initialize: check CONSOLE_HARNESS_COMMAND"', async () => {
    expect(run.stdout).toContain("FAIL  harness: it did not answer ACP initialize: check CONSOLE_HARNESS_COMMAND\n");
  });
});
