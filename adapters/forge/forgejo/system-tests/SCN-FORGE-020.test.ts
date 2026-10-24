import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FORGE-020", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('the client ran "protect tester/web main --check verify"', async () => {
    box = await setup(sut, fakes);
    await box.json(["protect", "tester/web", "main", "--check", "verify"]);
  });

  await given(
    'an open pull request in "tester/web" whose head commit has the status "verify" with "failure"',
    async () => {
      pr = await openPullRequest(box.forge);
      await box.json(["check", "tester/web", pr.sha, "verify", "failure"]);
    },
  );

  await when('the client runs "protect tester/web main" with no check', async () => {
    expect(await box.json(["protect", "tester/web", "main"])).toEqual({ branch: "main", checks: [], approvals: 0 });
  });

  let printed: Record<string, unknown>;
  await when('the client runs "merge" for the pull request', async () => {
    printed = await box.json(["merge", "tester/web", String(pr.number)]);
  });

  await then("merge prints the merge commit", async () => {
    expect(printed).toEqual({ sha: expect.stringMatching(/^[0-9a-f]{40}$/) });
    expect((await box.forge.pullRequests("web")).map((opened) => opened.state)).toEqual(["closed"]);
  });
});
