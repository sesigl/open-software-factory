import { type CliResult, scenario } from "@opensoftware/testkit";
import { doctorEnv } from "./secrets.ts";

scenario("SCN-CONSOLE-187", async ({ sut, fakes, given, when, then }) => {
  const address = "http://127.0.0.1:1";
  let env: Record<string, string> = {};
  await given(
    'a factory whose agent "triage" declares "ref:openbao/linear-token", and "OSF_OPENBAO_ADDR" names a port where nothing listens',
    async () => {
      const agents = { triage: { secrets: ["ref:openbao/linear-token"] } };
      env = (await doctorEnv(sut, fakes, agents, { env: { OSF_OPENBAO_ADDR: address } })).env;
    },
  );

  let run: CliResult;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  secrets: the store at <address> does not answer: check OSF_OPENBAO_ADDR, OSF_OPENBAO_TOKEN and CONSOLE_SECRETS_ADAPTER"',
    async () => {
      expect(run.stdout.split("\n").slice(-2)).toEqual([
        `FAIL  secrets: the store at ${address} does not answer: check OSF_OPENBAO_ADDR, OSF_OPENBAO_TOKEN and CONSOLE_SECRETS_ADAPTER`,
        "",
      ]);
    },
  );
});
