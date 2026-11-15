import { type CliResult, scenario } from "@opensoftware/testkit";
import { doctorEnv, VALUE } from "./secrets.ts";

scenario("SCN-CONSOLE-186", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a factory whose agent "triage" declares "ref:openbao/linear-token" and whose agent "review" declares "ref:openbao/sentry-token", and a store with only "linear-token"',
    async () => {
      const setup = await doctorEnv(sut, fakes, {
        triage: { secrets: ["ref:openbao/linear-token"] },
        review: { secrets: ["ref:openbao/sentry-token"] },
      });
      await setup.bao.write("linear-token", { value: VALUE });
      env = setup.env;
    },
  );

  let run: CliResult;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('it prints "ok    secrets", "ok    secrets token" and "ok    secret linear-token"', async () => {
    expect(run.stdout).toContain("ok    secrets\nok    secrets token\nok    secret linear-token\n");
  });

  await then(
    'it prints "FAIL  secret sentry-token: no value in the store for the agent review: store one on /secrets"',
    async () => {
      expect(run.stdout.split("\n").at(-2)).toBe(
        "FAIL  secret sentry-token: no value in the store for the agent review: store one on /secrets",
      );
    },
  );
});
