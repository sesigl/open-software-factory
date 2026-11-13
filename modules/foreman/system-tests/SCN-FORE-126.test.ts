import { scenario } from "@opensoftware/testkit";
import { firstRunOf, servingPullRequests } from "./foreman.ts";

scenario("SCN-FORE-126", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingPullRequests>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has the head "osf/<run ID>" and the check "verify" in the state "success", and whose pull request "tester/web#2" has another head',
    async () => {
      server = await servingPullRequests(sut, fakes, {
        pulls: [
          { repository: "web", branch: `osf/${firstRunOf(fakes)}` },
          { repository: "web", branch: "export-csv" },
        ],
        reply: ([mine, other]) => `Opened ${mine}. It builds on ${other}.`,
      });
    },
  );
  await given(
    'the scripted "implement" turn replies with the link of "tester/web#1" and then the link of "tester/web#2"',
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
    // The forge has the pull request of the run's branch from the first stage on, so no stage needs a note.
    expect(view.stages.map((stage) => stage.note)).toEqual([undefined, undefined, undefined]);
  });

  await then('every prompt the harness received has the line "Branch: osf/<run ID>"', async () => {
    const prompts = server.harness.prompts();
    expect(prompts).toHaveLength(3);
    for (const prompt of prompts) expect(prompt).toContain(`\n\nBranch: ${server.branch}\n`);
  });
});
