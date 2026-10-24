import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FORGE-009", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('the client ran "protect tester/web main --check verify"', async () => {
    box = await setup(sut, fakes);
    await box.json(["protect", "tester/web", "main", "--check", "verify"]);
  });

  await given(
    'an open pull request in "tester/web" whose head commit has the status "verify" with "success"',
    async () => {
      pr = await openPullRequest(box.forge);
      await box.json(["check", "tester/web", pr.sha, "verify", "success"]);
    },
  );

  let printed: Record<string, unknown>;
  await when('the client runs "merge" for it with the method "squash"', async () => {
    printed = await box.json(["merge", "tester/web", String(pr.number), "--method", "squash"]);
  });

  await then("merge prints the merge commit", async () => {
    expect(printed).toEqual({ sha: expect.stringMatching(/^[0-9a-f]{40}$/) });
  });

  await then("the test forge shows the pull request merged with that commit", async () => {
    expect(await box.json(["pr", "tester/web", String(pr.number)])).toMatchObject({
      state: "merged",
      mergeCommit: printed.sha,
    });
  });

  await then('"main" on the test forge holds the pull request\'s change', async () => {
    const main = (await box.forge.branches("web")).find((branch) => branch.name === "main");
    expect(main?.sha).toBe(printed.sha);
    expect(await box.forge.file("web", "checkout.js", "main")).toBe("export const fixed = true;\n");
  });
});
