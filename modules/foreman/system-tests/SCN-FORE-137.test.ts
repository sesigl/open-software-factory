import { scenario } from "@opensoftware/testkit";
import { firstRunOf, servingPullRequests } from "./foreman.ts";

scenario("SCN-FORE-137", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingPullRequests>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has the head "osf/<run ID>" and the check "verify" in the state "success", with no "FOREMAN_FORGES" and an "npx" that runs the forge adapter',
    async () => {
      server = await servingPullRequests(sut, fakes, {
        pulls: [{ repository: "web", branch: `osf/${await firstRunOf(fakes)}` }],
        reply: () => "done",
        npx: true,
      });
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
  });

  await then('"npx" ran "@opensoftware/forge-github@^0" for "prs" and for "pr"', async () => {
    const calls = (await sut.files.read("$OUTPUT/npx.log")).split("\n");
    expect(calls).toContainEqual(expect.stringMatching(/^-y @opensoftware\/forge-github@\^0 prs /));
    expect(calls).toContainEqual(expect.stringMatching(/^-y @opensoftware\/forge-github@\^0 pr /));
  });
});
