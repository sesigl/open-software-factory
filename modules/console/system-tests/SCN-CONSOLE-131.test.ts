import { scenario } from "@opensoftware/testkit";
import { natsEnv, pingedForeman } from "./console.ts";

scenario("SCN-CONSOLE-131", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a NATS server with the stream "OSF" in "CONSOLE_NATS_URL"', async () => {
    env = await natsEnv(sut, fakes);
  });

  await given("a foreman that has received no ping", async () => {
    env = { ...env, ...(await pingedForeman(fakes, false)) };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  events: the foreman did not receive the ping in 10 s: update the foreman to a release that shows /v1/doctor/pings and check its FOREMAN_NATS_URL"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  events: the foreman did not receive the ping in 10 s: update the foreman to a release that shows /v1/doctor/pings and check its FOREMAN_NATS_URL\n",
      );
    },
  );
});
