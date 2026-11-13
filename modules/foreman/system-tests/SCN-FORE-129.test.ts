import { scenario } from "@opensoftware/testkit";
import { servingPullRequests } from "./foreman.ts";

scenario("SCN-FORE-129", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingPullRequests>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has another head than "osf/<run ID>"',
    async () => {
      server = await servingPullRequests(sut, fakes, {
        pulls: [{ repository: "web", branch: "export-csv" }],
        reply: ([link]) => `Opened ${link} for review.`,
      });
    },
  );
  await given('the scripted "implement" turn replies with the link of "tester/web#1" in a sentence', async () => {
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
    '"/v1/runs/<id>" shows the state "failed" with no "pullRequest" and the stage "ship" "failed" with the reason "no earlier stage linked a pull request"',
    async () => {
      const view = await server.until(runId, "failed");
      expect(view.pullRequest).toBeUndefined();
      expect(view.stages[2]).toMatchObject({
        stage: "ship",
        state: "failed",
        reason: "no earlier stage linked a pull request",
      });
    },
  );

  await then(
    'the stage "implement" has the note "no pull request of tester/web has the head osf/<run ID>, and the agent stated none"',
    async () => {
      const view = await server.view(runId);
      expect(view.stages[1]?.note).toBe(
        `no pull request of tester/web has the head ${server.branch}, and the agent stated none`,
      );
    },
  );
});
