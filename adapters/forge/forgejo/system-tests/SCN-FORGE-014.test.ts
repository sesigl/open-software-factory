import { isValid } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { delivery, openPullRequest, receiver, setup } from "./forge.ts";

scenario("SCN-FORGE-014", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let hooks: Awaited<ReturnType<typeof receiver>>;
  await given(
    'a webhook the client registered for "tester/web" at a receiver with the secret "whsec-51c2"',
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

  await when('the person "reviewer" approves the pull request', async () => {
    await box.forge.review(pr, "APPROVED", "looks good");
  });

  let printed: Record<string, unknown>;
  await when('the client runs "event" on the review\'s delivery', async () => {
    printed = await box.json(["event", await delivery(sut, hooks.api, "pull_request_review_approved")]);
  });

  await then(
    'event prints a "pr.reviewed@v1" CloudEvent with the state "approved" and the reviewer "reviewer"',
    async () => {
      expect(isValid("pr-reviewed", printed), JSON.stringify(printed)).toBe(true);
      expect(printed).toMatchObject({ type: "pr.reviewed@v1", subject: pr.url });
      expect(printed.data).toEqual({
        url: pr.url,
        reviewer: { kind: "person", id: "forgejo:reviewer", displayName: "reviewer" },
        state: "approved",
      });
    },
  );
});
