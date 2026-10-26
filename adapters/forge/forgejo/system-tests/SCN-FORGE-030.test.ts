import { isValid } from "@opensoftware/contracts";
import { type Issue, scenario } from "@opensoftware/testkit";
import { delivery, receiver, setup } from "./forge.ts";

scenario("SCN-FORGE-030", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let hooks: Awaited<ReturnType<typeof receiver>>;
  await given(
    'a webhook the client registered for "tester/web" with "--event issue.labeled" at a receiver with the secret "whsec-51c2"',
    async () => {
      box = await setup(sut, fakes);
      hooks = await receiver(fakes);
      await box.json(["webhook", "tester/web", hooks.url, "--event", "issue.labeled"]);
    },
  );

  let issue: Issue;
  await given(
    'the issue "Export reports as CSV" in "tester/web" with the body "Finance needs the monthly report as CSV"',
    async () => {
      issue = await box.forge.openIssue("web", {
        title: "Export reports as CSV",
        body: "Finance needs the monthly report as CSV",
      });
    },
  );

  await when('"tester" adds the label "factory" to the issue', async () => {
    await box.forge.label("web", issue.number, "factory");
  });

  let printed: Record<string, unknown>;
  await when('the client runs "event" on the delivery of the label', async () => {
    printed = await box.json(["event", await delivery(sut, hooks.api, "issue_label", "label_updated")]);
  });

  await then('event prints an "issue.labeled@v1" CloudEvent that the contract accepts', async () => {
    expect(isValid("issue-labeled", printed), JSON.stringify(printed)).toBe(true);
    const id = hooks.api.headers().find((request) => request.headers["x-forgejo-event-type"] === "issue_label")
      ?.headers["x-forgejo-delivery"];
    expect(printed).toMatchObject({ type: "issue.labeled@v1", source: "/osf/forge", id, subject: issue.url });
  });

  await then(
    'its data names the issue\'s link, number, title, body, the author "tester" and the labels "factory"',
    async () => {
      expect(printed.data).toEqual({
        url: issue.url,
        repository: issue.url.replace(/\/issues\/\d+$/, ""),
        number: issue.number,
        title: "Export reports as CSV",
        body: "Finance needs the monthly report as CSV",
        author: { kind: "person", id: "forgejo:tester", displayName: "tester" },
        labels: ["factory"],
      });
    },
  );
});
