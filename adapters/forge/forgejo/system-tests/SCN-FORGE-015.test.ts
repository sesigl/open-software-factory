import { isValid } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { delivery, openPullRequest, receiver, SECRET, setup } from "./forge.ts";

scenario("SCN-FORGE-015", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let hooks: Awaited<ReturnType<typeof receiver>>;
  await given(
    `a webhook the client registered for "tester/web" at a receiver with the secret "${SECRET}"`,
    async () => {
      box = await setup(sut, fakes);
      hooks = await receiver(fakes);
      await box.json(["webhook", "tester/web", hooks.url]);
    },
  );

  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('an open pull request in "tester/web"', async () => {
    pr = await openPullRequest(box.forge);
  });

  let mergeCommit = "";
  await when("a person merges the pull request", async () => {
    mergeCommit = await box.forge.mergePullRequest(pr);
  });

  let printed: Record<string, unknown>;
  await when('the client runs "event" on the delivery of the close', async () => {
    printed = await box.json(["event", await delivery(sut, hooks.api, "pull_request", "closed")]);
  });

  await then('event prints a "pr.closed@v1" CloudEvent with "merged" true and the merge commit', async () => {
    expect(isValid("pr-closed", printed), JSON.stringify(printed)).toBe(true);
    expect(printed).toMatchObject({ type: "pr.closed@v1", subject: pr.url });
    expect(printed.data).toEqual({ url: pr.url, merged: true, mergeCommit });
  });
});
