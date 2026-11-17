import { type Forge, type PullRequest, scenario } from "@opensoftware/testkit";
import { forgeClient } from "./forge.ts";

scenario("SCN-TK-082", async ({ fakes, given, when, then }) => {
  let forge: Forge;
  let pr: PullRequest;
  await given('a pull request in fakes.forge that the test approved as the person "reviewer"', async () => {
    forge = await fakes.forge();
    await forge.createRepository("demo");
    pr = await forge.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\n" } });
    await forge.review(pr, "APPROVED", "looks good");
  });

  let reviews: { user: { login: string }; state: string }[] = [];
  await when("a module reads the reviews of the pull request through the forge's API", async () => {
    reviews = await forgeClient(forge, "demo")("GET", `/pulls/${pr.number}/reviews`);
  });

  await then('the pull request has one review, "reviewer APPROVED"', async () => {
    expect(reviews.map((review) => `${review.user.login} ${review.state}`)).toEqual(["reviewer APPROVED"]);
  });
});
