import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FORGE-006", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given(
    'an open pull request in "tester/web" whose head commit has the status "verify" with "success"',
    async () => {
      box = await setup(sut, fakes);
      pr = await openPullRequest(box.forge);
      const url = "https://ci.example/runs/7";
      await box.json(["check", "tester/web", pr.sha, "verify", "success", "--description", "all passed", "--url", url]);
    },
  );

  let printed: Record<string, unknown>;
  await when('the client runs "pr" for it', async () => {
    printed = await box.json(["pr", "tester/web", String(pr.number)]);
  });

  await then(
    'pr prints the state "open", "mergeable" true, the head commit and the check "verify" with "success"',
    async () => {
      expect(printed).toEqual({
        number: pr.number,
        url: pr.url,
        title: "Fix checkout button on Safari",
        state: "open",
        mergeable: true,
        head: "fix-checkout",
        base: "main",
        sha: pr.sha,
        mergeCommit: null,
        checks: [{ name: "verify", state: "success", description: "all passed", url: "https://ci.example/runs/7" }],
      });
    },
  );
});
