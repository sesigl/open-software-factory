import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-021", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the branch "fix-checkout" of "tester/web" that creates "checkout.js"', async () => {
    box = await setup(sut, fakes);
    await box.forge.createBranch("web", { branch: "fix-checkout", files: { "checkout.js": "fixed\n" } });
  });

  await given(
    'a person merged another pull request into "main" that creates "checkout.js" with other content',
    async () => {
      const other = await box.forge.openPullRequest("web", {
        branch: "rewrite-checkout",
        title: "Rewrite checkout",
        files: { "checkout.js": "rewritten\n" },
      });
      await box.forge.mergePullRequest(other);
    },
  );

  let number = "";
  await given('the client opened a pull request from "fix-checkout"', async () => {
    const opened = await box.json(["open-pr", "tester/web", "fix-checkout", "--title", "Fix checkout"]);
    number = String(opened.number);
  });

  let state: Record<string, unknown>;
  let merge: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "pr" and "merge" for it', async () => {
    state = await box.json(["pr", "tester/web", number]);
    merge = await box.run(["merge", "tester/web", number]);
  });

  await then('pr prints "mergeable" false', async () => {
    expect(state).toMatchObject({ state: "open", mergeable: false, head: "fix-checkout" });
  });

  await then("merge exits with code 1 and an error that names the conflict", async () => {
    expect(merge.exitCode, merge.stderr).toBe(1);
    expect(merge.stderr).toBe(`forge-github: the forge refused to merge #${number}: it conflicts with its base\n`);
  });

  await then("the pull request is still open on the test forge", async () => {
    const pulls = await box.forge.pullRequests("web");
    expect(pulls.find((pull) => String(pull.number) === number)?.state).toBe("open");
  });
});
