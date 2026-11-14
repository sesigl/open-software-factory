import { scenario } from "@opensoftware/testkit";
import { readmeWork, servingChecks, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-161", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingChecks>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub and NATS, whose pull request "tester/web#1" has the check "verify" in the state "success"',
    async () => {
      server = await servingChecks(sut, fakes, { check: "success", nats: true });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.run.>");
    },
  );
  await given('the scripted "implement" turn replies with the link of that pull request', async () => {
    expect(server.pr.number).toBe(1);
  });

  await when(
    'a program posts the README\'s "work.json" to "/v1/runs" with the API token and the run completes',
    async () => {
      const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
      await server.until(runId, "complete");
    },
  );

  await then('the server published no "run.blocked@v1", and its "run.completed@v1" names no reason', async () => {
    const [completed] = await events.received("run.completed@v1", { timeoutMs: WAIT_MS });
    expect(completed?.data).toMatchObject({ outcome: "succeeded", stage: "ship" });
    expect(completed?.data).not.toHaveProperty("reason");
    expect(await events.received("run.blocked@v1", { count: 0 })).toEqual([]);
  });
});
