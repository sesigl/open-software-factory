import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FORGE-027", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('an open pull request in "tester/web" from "fix-checkout" that adds "checkout.js"', async () => {
    box = await setup(sut, fakes);
    pr = await openPullRequest(box.forge);
  });

  let printed: Record<string, unknown>;
  await when('the client runs "pr" for it', async () => {
    printed = await box.json(["pr", "tester/web", String(pr.number)]);
  });

  await then(
    'pr prints the author "tester" with the adapter\'s name, "draft" false, no labels and the paths "checkout.js"',
    async () => {
      const { author, draft, labels, paths } = printed;
      expect({ author, draft, labels, paths }).toEqual({
        author: "github:tester",
        draft: false,
        labels: [],
        paths: ["checkout.js"],
      });
    },
  );
});
