import { scenario } from "@opensoftware/testkit";
import { natsEnv, pingedForeman } from "./console.ts";

scenario("SCN-CONSOLE-132", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a NATS server without a stream in "CONSOLE_NATS_URL"', async () => {
    env = { ...(await natsEnv(sut, fakes, false)), ...(await pingedForeman(fakes, true)) };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  events: no stream takes osf.doctor.ping.v1: start the foreman with FOREMAN_NATS_URL set to the same server, which adds the stream OSF"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  events: no stream takes osf.doctor.ping.v1: start the foreman with FOREMAN_NATS_URL set to the same server, which adds the stream OSF\n",
      );
    },
  );
});
