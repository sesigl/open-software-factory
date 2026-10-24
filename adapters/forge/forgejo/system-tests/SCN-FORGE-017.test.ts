import { scenario } from "@opensoftware/testkit";
import { delivery, openPullRequest, receiver, SECRET, setup } from "./forge.ts";

scenario("SCN-FORGE-017", async ({ sut, fakes, given, when, then }) => {
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

  await when('"tester" comments on the pull request', async () => {
    await box.json(["comment", "tester/web", String(pr.number), "Evidence attached"]);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "event" on the comment\'s delivery', async () => {
    run = await box.run(["event", await delivery(sut, hooks.api, "pull_request_comment")]);
  });

  await then("event exits with code 0 and prints nothing", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe("");
  });
});
