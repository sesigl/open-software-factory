import { scenario } from "@opensoftware/testkit";
import { delivery, openPullRequest, receiver, setup } from "./forge.ts";

scenario("SCN-FORGE-016", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let file = "";
  await given('a delivery the receiver got from a webhook with the secret "whsec-51c2"', async () => {
    box = await setup(sut, fakes);
    const hooks = await receiver(fakes);
    await box.json(["webhook", "tester/web", hooks.url]);
    await openPullRequest(box.forge);
    file = await delivery(sut, hooks.api, "pull_request", "opened");
    // The same delivery passes with the right secret, so only the secret differs below.
    expect((await box.run(["event", file])).exitCode).toBe(0);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "event" on it with "FORGE_WEBHOOK_SECRET" set to "whsec-other"', async () => {
    run = await box.run(["event", file], { FORGE_WEBHOOK_SECRET: "whsec-other" });
  });

  await then("event exits with code 1 and an error that names the signature", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toBe("forge-forgejo: the delivery's signature does not match FORGE_WEBHOOK_SECRET\n");
  });

  await then("event prints no event", async () => {
    expect(run.stdout).toBe("");
  });
});
