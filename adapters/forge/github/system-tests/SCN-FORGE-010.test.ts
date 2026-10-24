import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FORGE-010", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('the client ran "protect tester/web main --approvals 1"', async () => {
    box = await setup(sut, fakes);
    expect(await box.json(["protect", "tester/web", "main", "--approvals", "1"])).toEqual({
      branch: "main",
      checks: [],
      approvals: 1,
    });
  });

  await given('an open pull request in "tester/web"', async () => {
    pr = await openPullRequest(box.forge);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "merge" for it', async () => {
    run = await box.run(["merge", "tester/web", String(pr.number)]);
  });

  await then("merge exits with code 1", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toMatch(
      /^forge-github: the forge refused to merge #1: At least 1 approving review is required by reviewers with write access\.$/m,
    );
  });

  await then("the pull request is still open on the test forge", async () => {
    expect((await box.forge.pullRequests("web")).map((opened) => opened.state)).toEqual(["open"]);
  });
});
