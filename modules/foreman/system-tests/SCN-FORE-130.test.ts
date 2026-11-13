import { scenario } from "@opensoftware/testkit";
import { firstRunOf, servingPullRequests } from "./foreman.ts";

scenario("SCN-FORE-130", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingPullRequests>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has the head "osf/<run ID>", and a forge adapter whose "prs" fails with "the forge is down"',
    async () => {
      server = await servingPullRequests(sut, fakes, {
        pulls: [{ repository: "web", branch: `osf/${await firstRunOf(fakes)}` }],
        reply: () => "done",
        prsFails: "the forge is down",
      });
    },
  );
  await given('the scripted "implement" turn replies with "done"', async () => {
    expect(server.pulls[0]?.number).toBe(1);
  });

  let runId = "";
  await when(
    'a program posts the README\'s "work.json" with the origin "tester/web#3" to "/v1/runs" with the API token',
    async () => {
      runId = (await server.start(server.work)).data?.runId as string;
    },
  );

  await then(
    '"/v1/runs/<id>" shows the stage "implement" "succeeded" with the note "the forge adapter\'s prs failed: the forge is down"',
    async () => {
      // Without a pull request the stage "ship" fails on its checks, after "implement" succeeded.
      const view = await server.until(runId, "failed");
      expect(view.stages[1]).toMatchObject({
        stage: "implement",
        state: "succeeded",
        note: "the forge adapter's prs failed: the forge is down",
      });
      expect(view.pullRequest).toBeUndefined();
    },
  );
});
