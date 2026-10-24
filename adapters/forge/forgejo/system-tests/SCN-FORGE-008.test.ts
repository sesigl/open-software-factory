import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FORGE-008", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('the client ran "protect tester/web main --check verify"', async () => {
    box = await setup(sut, fakes);
    expect(await box.json(["protect", "tester/web", "main", "--check", "verify"])).toEqual({
      branch: "main",
      checks: ["verify"],
      approvals: 0,
    });
  });

  await given(
    'an open pull request in "tester/web" whose head commit has the status "verify" with "failure"',
    async () => {
      pr = await openPullRequest(box.forge);
      await box.json(["check", "tester/web", pr.sha, "verify", "failure"]);
    },
  );

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "merge" for it', async () => {
    run = await box.run(["merge", "tester/web", String(pr.number)]);
  });

  await then("merge exits with code 1 and an error that names the pull request's number", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toMatch(/^forge-forgejo: the forge refused to merge #1: .*status checks/);
    expect(run.stdout).toBe("");
  });

  await then("the pull request is still open on the test forge", async () => {
    expect((await box.forge.pullRequests("web")).map((opened) => opened.state)).toEqual(["open"]);
  });
});
