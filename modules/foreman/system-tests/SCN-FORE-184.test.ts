import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving, untilWarned, workReceived } from "./foreman.ts";

scenario("SCN-FORE-184", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      server = await serving(sut, fakes, { nats: true });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.>");
    },
  );

  await given('"agents/plan.md" gets a change that is not committed', async () => {
    await sut.files.put("$INPUT/agents/plan.md", "Write a plan, and a short one\n");
  });

  await when('intake publishes "work.received@v1" with the README\'s "work.json"', async () => {
    await events.publish("osf.work.received.v1", workReceived(fakes));
  });

  await when("the change is committed", async () => {
    // The first delivery failed once the server warned; its nak brings the message again after 2 seconds.
    await untilWarned(sut, "osf.work.received.v1");
    await sut.git.commit("a shorter plan");
  });

  await then('within 20 seconds the server publishes "run.started@v1" for the work item', async () => {
    const [started] = await events.received("run.started@v1", { timeoutMs: 20_000 });
    expect(started?.data).toMatchObject({ workItemId: readmeWork(fakes).id });
  });

  await then(
    'it warned about "osf.work.received.v1" that "commit the changed files agents/plan.md", for the delivery 1 of 5',
    async () => {
      const warnings = sut.http
        .output()
        .stderr.split("\n")
        .filter((line) => line.includes("osf."));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(
        /^foreman: osf\.work\.received\.v1: factory\.yaml: commit the changed files agents\/plan\.md; .+ \(delivery 1 of 5\)$/,
      );
    },
  );
});
