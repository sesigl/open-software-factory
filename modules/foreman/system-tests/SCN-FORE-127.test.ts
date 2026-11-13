import { scenario } from "@opensoftware/testkit";
import { servingPullRequests } from "./foreman.ts";

scenario("SCN-FORE-127", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingPullRequests>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub, whose pull requests "tester/web#1" and "tester/web#2" have other heads than "osf/<run ID>" and "tester/web#1" has the check "verify" in the state "success"',
    async () => {
      server = await servingPullRequests(sut, fakes, {
        pulls: [
          { repository: "web", branch: "export-csv" },
          { repository: "web", branch: "osf/run_other" },
        ],
        reply: ([mine, other]) => `Done.\nPull request: ${mine}\nSee also ${other} for the import.`,
      });
    },
  );
  await given(
    'the scripted "implement" turn replies with the line "Pull request: <link of tester/web#1>" and then the link of "tester/web#2"',
    async () => {
      expect(server.pulls.map((pull) => pull.number)).toEqual([1, 2]);
    },
  );

  let runId = "";
  await when(
    'a program posts the README\'s "work.json" with the origin "tester/web#3" to "/v1/runs" with the API token',
    async () => {
      runId = (await server.start(server.work)).data?.runId as string;
    },
  );

  await then('"/v1/runs/<id>" shows the state "complete" and the link of "tester/web#1" as "pullRequest"', async () => {
    const view = await server.until(runId, "complete");
    expect(view.pullRequest).toBe(server.pulls[0]?.url);
    expect((view.stages[1] as { note?: string }).note).toBeUndefined();
  });
});
