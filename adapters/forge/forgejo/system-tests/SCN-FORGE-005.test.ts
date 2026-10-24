import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FORGE-005", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('an open pull request in "tester/web"', async () => {
    box = await setup(sut, fakes);
    pr = await openPullRequest(box.forge);
  });

  let printed: Record<string, unknown>;
  await when('the client runs "comment" on it with the text "Evidence: 14 scenarios passed"', async () => {
    printed = await box.json(["comment", "tester/web", String(pr.number), "Evidence: 14 scenarios passed"]);
  });

  await then('the test forge shows the comment "Evidence: 14 scenarios passed" on the pull request', async () => {
    expect(await box.forge.comments(pr)).toEqual(["Evidence: 14 scenarios passed"]);
  });

  await then("comment prints the comment's ID and URL", async () => {
    expect(printed).toEqual({
      id: expect.any(Number),
      url: expect.stringMatching(new RegExp(`/tester/web/pulls/1#issuecomment-${printed.id}$`)),
    });
  });
});
