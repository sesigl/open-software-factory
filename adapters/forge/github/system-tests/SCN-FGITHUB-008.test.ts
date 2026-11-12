import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FGITHUB-008", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given(
    'an open pull request in "tester/web" whose head commit has 150 check runs, the last one "verify" with "success"',
    async () => {
      box = await setup(sut, fakes);
      pr = await openPullRequest(box.forge);
      for (let job = 1; job < 150; job++) await box.forge.checkRun(pr, { name: `job ${job}`, status: "in_progress" });
      await box.forge.checkRun(pr, { name: "verify", conclusion: "success" });
    },
  );

  let printed: Record<string, unknown>;
  await when('the client runs "pr" for it', async () => {
    printed = await box.json(["pr", "tester/web", String(pr.number)]);
  });

  await then('pr lists 150 checks, among them "verify" with "success"', async () => {
    const checks = printed.checks as { name: string; state: string }[];
    expect(checks).toHaveLength(150);
    expect(checks.at(-1)).toMatchObject({ name: "verify", state: "success", description: "" });
  });
});
