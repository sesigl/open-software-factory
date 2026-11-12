import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FGITHUB-007", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given(
    'an open pull request in "tester/web" whose head commit has, for "verify", "lint" and "deploy", the statuses "success", "pending" and "error" and the check runs "failure", "success" and "failure"',
    async () => {
      box = await setup(sut, fakes);
      pr = await openPullRequest(box.forge);
      for (const [name, state] of [
        ["verify", "success"],
        ["lint", "pending"],
        ["deploy", "error"],
      ] as const) {
        await box.json(["check", "tester/web", pr.sha, name, state, "--description", `${name} status`]);
      }
      await box.forge.checkRun(pr, { name: "verify", conclusion: "failure", title: "verify run" });
      await box.forge.checkRun(pr, { name: "lint", conclusion: "success", title: "lint run" });
      await box.forge.checkRun(pr, { name: "deploy", conclusion: "failure", title: "deploy run" });
    },
  );

  let printed: Record<string, unknown>;
  await when('the client runs "pr" for it', async () => {
    printed = await box.json(["pr", "tester/web", String(pr.number)]);
  });

  await then(
    'pr lists each name once: "verify" with "failure", "lint" with "pending" and "deploy" with "error"',
    async () => {
      const checks = printed.checks as { name: string; state: string; description: string }[];
      expect(
        checks
          .map(({ name, state, description }) => ({ name, state, description }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ).toEqual([
        { name: "deploy", state: "error", description: "deploy status" },
        { name: "lint", state: "pending", description: "lint status" },
        { name: "verify", state: "failure", description: "verify run" },
      ]);
    },
  );
});
