import { scenario } from "@opensoftware/testkit";
import { readmeWork, servingChecks, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-047", async ({ sut, fakes, given, when, then }) => {
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

  let runId = "";
  await when(
    'a program posts the README\'s "work.json" to "/v1/runs" with the API token and the run completes',
    async () => {
      runId = (await server.start(readmeWork(fakes))).data?.runId as string;
      await server.until(runId, "complete");
    },
  );

  await then('"/v1/runs/<id>" shows the pull request\'s link as "pullRequest"', async () => {
    expect((await server.view(runId)).pullRequest).toBe(server.pr.url);
  });

  await then(
    'the "run.completed@v1" on "osf.run.completed.v1" lists the pull request\'s link in "pullRequests"',
    async () => {
      const [completed] = await events.received("run.completed@v1", { timeoutMs: WAIT_MS });
      expect(completed?.data).toMatchObject({ runId, stage: "ship", pullRequests: [server.pr.url] });
    },
  );
});
