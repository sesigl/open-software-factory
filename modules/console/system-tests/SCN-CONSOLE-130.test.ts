import { scenario } from "@opensoftware/testkit";
import { natsEnv, PING, pingedForeman } from "./console.ts";

scenario("SCN-CONSOLE-130", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given('a NATS server with the stream "OSF" in "CONSOLE_NATS_URL"', async () => {
    env = await natsEnv(sut, fakes);
    events = await sut.events.watch({ url: env.CONSOLE_NATS_URL as string }, "osf.>");
  });

  await given('a foreman that has received the ping "ping_6b86b273ff34fce19d6b"', async () => {
    env = { ...env, ...(await pingedForeman(fakes, true)) };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then('it prints "ok    events"', async () => {
    expect(run.stdout, run.stderr).toMatch(/^ok {4}events$/m);
  });

  await then(
    'NATS has one "doctor.ping@v1" from "/osf/console" with the ID "ping_6b86b273ff34fce19d6b" on "osf.doctor.ping.v1"',
    async () => {
      const pings = await events.received("doctor.ping@v1");
      expect(pings).toEqual([
        expect.objectContaining({ specversion: "1.0", id: PING, source: "/osf/console", data: {} }),
      ]);
      expect(Number.isNaN(Date.parse(String(pings[0]?.time)))).toBe(false);
    },
  );
});
