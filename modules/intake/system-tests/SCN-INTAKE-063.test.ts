import { scenario } from "@opensoftware/testkit";
import { following, runEvent } from "./server.ts";

scenario("SCN-INTAKE-063", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof following>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, received the README\'s "work.json"',
    async () => {
      server = await following(sut, fakes);
    },
  );

  await when('the foreman publishes "run.completed@v1" for the work item with the outcome "merged"', async () => {
    await server.publish(runEvent(server.id, "merged" as never));
  });

  const health = async () => {
    const answer = await sut.http.request("GET", "/v1/health");
    return { status: answer.status, body: answer.body as { checks: { name: string; detail?: string }[] } };
  };
  await then('within 15 seconds "/v1/health" answers 503 with the check "nats" failing for 1 dead letter', async () => {
    // The deliveries 1 to 5 come 2 seconds apart; the fifth failure keeps the event as a dead letter.
    await expect.poll(async () => (await health()).status, { timeout: 15_000, interval: 200 }).toBe(503);
    const dead = (await health()).body.checks.find(({ name }) => name === "nats");
    expect(dead?.detail).toMatch(
      /^1 run events failed 5 times and wait on osf\.dead\.intake\.>; .+, then run "intake resend": check INTAKE_NATS_URL/,
    );
    expect(sut.http.output().stderr).toMatch(
      /osf\.run\.completed\.v1: .+ \(delivery 5 of 5, kept on osf\.dead\.intake\.run\.completed\.v1\)\n/,
    );
  });

  let printed = "";
  await when('the user runs "intake resend" with "INTAKE_NATS_URL" set to the NATS server', async () => {
    const run = await sut.cli(["resend"], { env: { INTAKE_NATS_URL: server.nats.url } });
    expect(run.exitCode, run.stderr).toBe(0);
    printed = run.stdout;
  });

  await then('it prints "resent osf.run.completed.v1" and "intake resent 1 dead letters"', async () => {
    expect(printed).toBe("resent osf.run.completed.v1\nintake resent 1 dead letters\n");
  });

  await then(
    '"/v1/health" answers 200, and the server warns about "osf.run.completed.v1" again, for the delivery 1 of 5',
    async () => {
      expect((await health()).status).toBe(200);
      const firsts = () => sut.http.output().stderr.match(/osf\.run\.completed\.v1: .+ \(delivery 1 of 5\)/g) ?? [];
      await expect.poll(() => firsts().length, { timeout: 5_000, interval: 100 }).toBe(2);
    },
  );
});
