import { scenario } from "@opensoftware/testkit";
import { readmeFiles, readmeWork, serving, workReceived } from "./foreman.ts";

scenario("SCN-FORE-147", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  let nats: NonNullable<typeof server.nats>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      server = await serving(sut, fakes, { nats: true });
      nats = server.nats as typeof nats;
      events = await sut.events.watch(nats, "osf.>");
    },
  );

  await given('the file "factory.yaml" is gone', async () => {
    await sut.files.remove("$INPUT/factory.yaml");
  });

  await when('intake publishes "work.received@v1" with the README\'s "work.json"', async () => {
    await events.publish("osf.work.received.v1", workReceived(fakes));
  });

  const nats503 = async () => {
    const answer = await sut.http.request("GET", "/v1/health");
    const { checks } = answer.body as { checks: { name: string; detail?: string }[] };
    return { status: answer.status, detail: checks.find(({ name }) => name === "nats")?.detail };
  };
  await then('within 15 seconds "/v1/health" answers 503 with the check "nats" failing for 1 dead letter', async () => {
    // The deliveries 1 to 5 come 2 seconds apart; the fifth failure keeps the event as a dead letter.
    await expect.poll(async () => (await nats503()).status, { timeout: 15_000, interval: 200 }).toBe(503);
    expect((await nats503()).detail).toMatch(
      /^1 events failed 5 times and wait on osf\.dead\.foreman\.>; .+, then run "foreman resend": check FOREMAN_NATS_URL/,
    );
    expect(sut.http.output().stderr).toMatch(
      /osf\.work\.received\.v1: .+ \(delivery 5 of 5, kept on osf\.dead\.foreman\.work\.received\.v1\)\n/,
    );
  });

  let printed = "";
  await when(
    'the file "factory.yaml" is back and the user runs "foreman resend" with "FOREMAN_NATS_URL" set to the NATS server',
    async () => {
      await sut.files.put("$INPUT/factory.yaml", readmeFiles(fakes)["factory.yaml"] as string);
      const run = await sut.cli(["resend"], { env: { FOREMAN_NATS_URL: nats.url } });
      expect(run.exitCode, run.stderr).toBe(0);
      printed = run.stdout;
    },
  );

  await then('it prints "resent osf.work.received.v1" and "foreman resent 1 dead letters"', async () => {
    expect(printed).toBe("resent osf.work.received.v1\nforeman resent 1 dead letters\n");
  });

  await then(
    'within 20 seconds the server publishes "run.started@v1" for the work item, and "/v1/health" answers 200',
    async () => {
      const [started] = await events.received("run.started@v1", { timeoutMs: 20_000 });
      expect(started?.data).toMatchObject({ workItemId: readmeWork(fakes).id });
      expect((await nats503()).status).toBe(200);
    },
  );
});
