import { isValid } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { delivery, receiver, setup } from "./forge.ts";

scenario("SCN-FORGE-013", async ({ sut, fakes, given, when, then }) => {
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

  let pr: Awaited<ReturnType<typeof box.forge.openPullRequest>>;
  await when('"tester" opens the pull request "Fix checkout button on Safari" from "fix-checkout"', async () => {
    pr = await box.forge.openPullRequest("web", {
      branch: "fix-checkout",
      title: "Fix checkout button on Safari",
      files: { "checkout.js": "fixed\n" },
    });
  });

  let printed: Record<string, unknown>;
  await when('the client runs "event" on the delivery the receiver got', async () => {
    printed = await box.json(["event", await delivery(sut, hooks.api, "pull_request", "opened")]);
  });

  await then('event prints a "pr.opened@v1" CloudEvent that the contract accepts', async () => {
    expect(isValid("pr-opened", printed), JSON.stringify(printed)).toBe(true);
    const id = hooks.api.headers().find((request) => request.headers["x-forgejo-event-type"])?.headers[
      "x-forgejo-delivery"
    ];
    expect(printed).toMatchObject({ type: "pr.opened@v1", source: "/osf/forge", id, subject: pr.url });
  });

  await then(
    'its data names the number, the title, "fix-checkout", "main", the head commit and the author "tester"',
    async () => {
      expect(printed.data).toEqual({
        url: pr.url,
        repository: pr.url.replace(/\/pulls\/1$/, ""),
        number: pr.number,
        title: "Fix checkout button on Safari",
        headBranch: "fix-checkout",
        baseBranch: "main",
        headCommit: pr.sha,
        author: { kind: "person", id: "forgejo:tester", displayName: "tester" },
      });
    },
  );
});
