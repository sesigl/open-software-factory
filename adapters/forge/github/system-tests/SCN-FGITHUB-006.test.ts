import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FGITHUB-006", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given(
    'an open pull request in "tester/web" whose check run "verify" failed and whose re-run of "verify" succeeded',
    async () => {
      box = await setup(sut, fakes);
      pr = await openPullRequest(box.forge);
      await box.forge.checkRun(pr, { name: "verify", conclusion: "failure", title: "2 scenarios failed" });
      await box.forge.checkRun(pr, { name: "verify", conclusion: "success", title: "all passed" });
    },
  );

  let printed: Record<string, unknown>;
  await when('the client runs "pr" for it', async () => {
    printed = await box.json(["pr", "tester/web", String(pr.number)]);
  });

  await then('pr lists the check "verify" once, with "success"', async () => {
    expect(printed.checks).toEqual([
      { name: "verify", state: "success", description: "all passed", url: expect.stringMatching(/\/runs\/\d+$/) },
    ]);
  });
});
