import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FORGE-007", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  let mergeCommit = "";
  await given('a pull request in "tester/web" that a person merged', async () => {
    box = await setup(sut, fakes);
    pr = await openPullRequest(box.forge);
    mergeCommit = await box.forge.mergePullRequest(pr);
  });

  let printed: Record<string, unknown>;
  await when('the client runs "pr" for it', async () => {
    printed = await box.json(["pr", "tester/web", String(pr.number)]);
  });

  await then('pr prints the state "merged" and the merge commit', async () => {
    expect(printed).toMatchObject({ number: pr.number, state: "merged", sha: pr.sha, mergeCommit, checks: [] });
    expect(mergeCommit).toMatch(/^[0-9a-f]{40}$/);
  });
});
