import { scenario } from "@opensoftware/testkit";
import { readmeWork, servingChecks, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-160", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingChecks>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub and NATS, whose pull request "tester/web#1" has the check "verify" in the state "pending"',
    async () => {
      server = await servingChecks(sut, fakes, { check: "pending", nats: true });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.run.>");
    },
  );
  await given('the scripted "implement" turn replies with the link of that pull request', async () => {
    expect(server.pr.number).toBe(1);
  });

  let runId = "";
  await when(
    'a program posts the README\'s "work.json" to "/v1/runs" with the API token, and the fake GitHub sets the check "verify" to "failure" 2500 ms after the stage "ship" blocked',
    async () => {
      runId = (await server.start(readmeWork(fakes))).data?.runId as string;
      await server.untilStage(runId, 2, "blocked");
      // Each read of the checks starts the forge adapter: 2.5 s give the foreman more reads while the stage waits.
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await server.check("failure");
      await server.until(runId, "failed");
    },
  );

  await then(
    'the server published one "run.blocked@v1" on "osf.run.blocked.v1" with the stage "ship", "waitsFor" "checks", the pull request\'s link and the check "verify"',
    async () => {
      await events.received("run.completed@v1", { timeoutMs: WAIT_MS });
      const blocked = await events.received("run.blocked@v1");
      expect(blocked).toHaveLength(1);
      expect(blocked[0]).toMatchObject({
        specversion: "1.0",
        id: `${runId}.blocked.ship`,
        source: "/osf/foreman",
        subject: runId,
        datacontenttype: "application/json",
      });
      expect(blocked[0]?.data).toEqual({
        runId,
        workItemId: readmeWork(fakes).id,
        stage: "ship",
        waitsFor: "checks",
        pullRequest: server.pr.url,
        checks: ["verify"],
        requester: readmeWork(fakes).requester,
        source: readmeWork(fakes).origin.source,
      });
    },
  );

  await then(
    'the "run.completed@v1" names the outcome "failed", the stage "ship" and the reason "the check verify ended with failure"',
    async () => {
      const [completed] = await events.received("run.completed@v1");
      expect(completed?.data).toMatchObject({
        outcome: "failed",
        stage: "ship",
        reason: "the check verify ended with failure",
      });
    },
  );
});
