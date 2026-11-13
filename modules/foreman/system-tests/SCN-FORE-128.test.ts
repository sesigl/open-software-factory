import { scenario } from "@opensoftware/testkit";
import { SHIP, servingPullRequests } from "./foreman.ts";

scenario("SCN-FORE-128", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingPullRequests>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub, whose repository "tester/app" has the pull request "tester/app#1"',
    async () => {
      server = await servingPullRequests(sut, fakes, {
        pulls: [{ repository: "app", branch: "export-csv" }],
        reply: ([other]) => `Pull request: ${other}`,
      });
    },
  );
  await given(
    'the scripted "implement" turn replies with the line "Pull request: <link of tester/app#1>"',
    async () => {
      expect(server.pulls[0]?.url).toBe(`${server.github.url}/tester/app/pull/1`);
    },
  );

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
      expect(server.prompts(SHIP)).toEqual([]);
    },
  );

  await then(
    'the stage "implement" has the note "the pull request <link of tester/app#1> is not of the work item\'s repository <fake GitHub>/tester/web"',
    async () => {
      const view = await server.view(runId);
      expect(view.stages[1]?.note).toBe(
        `the pull request ${server.pulls[0]?.url} is not of the work item's repository ${server.github.url}/tester/web`,
      );
    },
  );
});
