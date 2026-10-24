import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FORGE-004", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('an open pull request in "tester/web"', async () => {
    box = await setup(sut, fakes);
    pr = await openPullRequest(box.forge);
  });

  let printed: Record<string, unknown>;
  await when(
    'the client runs "check" on its head commit with the name "verify", the state "failure" and the description "2 scenarios failed"',
    async () => {
      const args = ["check", "tester/web", pr.sha, "verify", "failure", "--description", "2 scenarios failed"];
      printed = await box.json(args);
    },
  );

  await then(
    'the test forge shows the status "verify" with "failure" and "2 scenarios failed" on the pull request\'s head commit',
    async () => {
      expect(await box.forge.statuses(pr)).toEqual([
        { context: "verify", state: "failure", description: "2 scenarios failed" },
      ]);
      expect(printed).toEqual({ name: "verify", state: "failure" });
    },
  );
});
