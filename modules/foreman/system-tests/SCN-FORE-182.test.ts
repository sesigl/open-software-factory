import { scenario } from "@opensoftware/testkit";
import { committed, readmeWork, servingCommit, untilWarned, workReceived } from "./foreman.ts";

scenario("SCN-FORE-182", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingCommit>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  // The remote is a link to the factory's repository, so the test takes it away and puts it back.
  const remote = () => sut.files.link("$OUTPUT/remote", sut.files.path("$INPUT"));
  await given(
    '"foreman serve" runs with "FOREMAN_FACTORY" set to "git+<url>" of the README\'s "factory.yaml" and "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      const commit = await committed(sut, fakes);
      await remote();
      server = await servingCommit(sut, fakes, commit, {
        nats: true,
        env: {
          FOREMAN_FACTORY: `git+file://${sut.files.path("$OUTPUT/remote")}`,
          OSF_DATA: sut.files.path("$OUTPUT/data"),
        },
      });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.>");
    },
  );

  await given("the Git remote is gone", async () => {
    await sut.files.remove("$OUTPUT/remote");
  });

  await when('intake publishes "work.received@v1" with the README\'s "work.json"', async () => {
    await events.publish("osf.work.received.v1", workReceived(fakes));
  });

  await when("the Git remote is back", async () => {
    // The first delivery failed once the server warned; its nak brings the message again after 2 seconds.
    await untilWarned(sut, "osf.work.received.v1");
    await remote();
  });

  await then('within 20 seconds the server publishes "run.started@v1" for the work item', async () => {
    const [started] = await events.received("run.started@v1", { timeoutMs: 20_000 });
    expect(started?.data).toMatchObject({ workItemId: readmeWork(fakes).id });
  });

  await then(
    'it warned about "osf.work.received.v1" that "FOREMAN_FACTORY: cannot fetch HEAD", for the delivery 1 of 5',
    async () => {
      // Git's own message can take several lines, so the warning is read as one text.
      const warnings = sut.http.output().stderr.split("foreman: osf.").slice(1);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(
        /^work\.received\.v1: FOREMAN_FACTORY: cannot fetch HEAD of [\s\S]+\(delivery 1 of 5\)\n$/,
      );
    },
  );
});
