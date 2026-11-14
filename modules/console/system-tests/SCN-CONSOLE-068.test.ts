import { scenario } from "@opensoftware/testkit";
import { factoryEnv } from "./console.ts";

scenario("SCN-CONSOLE-068", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('the factory definition with the agent "triage" on the route "routes/triage"', async () => {
    env = await factoryEnv(sut);
  });

  await given('"CONSOLE_MODEL_URL" names a port where nothing listens', async () => {
    env = { ...env, CONSOLE_MODEL_URL: "http://127.0.0.1:1/v1" };
  });

  await given('"CONSOLE_HARNESS_COMMAND" is a command that exits without a word', async () => {
    env = { ...env, CONSOLE_HARNESS_COMMAND: "true" };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then(
    'it prints "FAIL  model routes/triage: no answer: check CONSOLE_MODEL_URL and that the gateway runs"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  model routes/triage: no answer: check CONSOLE_MODEL_URL and that the gateway runs\n",
      );
    },
  );

  await then('it prints "FAIL  harness: it did not answer ACP initialize: check CONSOLE_HARNESS_COMMAND"', async () => {
    expect(run.stdout).toContain("FAIL  harness: it did not answer ACP initialize: check CONSOLE_HARNESS_COMMAND\n");
  });
});
