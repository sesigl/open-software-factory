import { scenario } from "@opensoftware/testkit";
import { pingedForeman } from "./console.ts";

scenario("SCN-CONSOLE-133", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('"CONSOLE_NATS_URL" names a port where nothing listens', async () => {
    env = { CONSOLE_NATS_URL: "nats://127.0.0.1:1", ...(await pingedForeman(fakes, true)) };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('it prints "FAIL  events: no answer from NATS: check CONSOLE_NATS_URL and that NATS runs"', async () => {
    expect(run.stdout).toContain("FAIL  events: no answer from NATS: check CONSOLE_NATS_URL and that NATS runs\n");
  });
});
