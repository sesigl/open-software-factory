import { type Forge, type PullRequest, scenario } from "@opensoftware/testkit";
import { forgeClient } from "./forge.ts";

scenario("SCN-TK-097", async ({ fakes, given, when, then }) => {
  let forge: Forge;
  let pr: PullRequest;
  await given('a pull request in fakes.forge on which the test had "reviewer" say "Looks good"', async () => {
    forge = await fakes.forge();
    await forge.createRepository("demo");
    pr = await forge.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\n" } });
    await forge.say(pr, "Looks good");
  });

  let comments: { user: { login: string }; body: string }[] = [];
  await when("a module reads the comments of the pull request through the forge's API", async () => {
    comments = await forgeClient(forge, "demo")("GET", `/issues/${pr.number}/comments`);
  });

  await then('the pull request has one comment, "reviewer Looks good"', async () => {
    expect(comments.map((comment) => `${comment.user.login} ${comment.body}`)).toEqual(["reviewer Looks good"]);
  });
});
