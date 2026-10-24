import { scenario } from "@opensoftware/testkit";
import { validate } from "@opensoftware/contracts";
import { CHANNEL, mention, PERSON, setup } from "./channel.ts";

scenario("SCN-CHANNEL-001", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let file = "";
  let ts = "";
  await given(
    'a delivery of the person\'s message that mentions the bot with "Fix the checkout button on Safari"',
    async () => {
      box = await setup(sut, fakes);
      const delivered = await mention(box);
      file = delivered.file;
      ts = delivered.message.ts;
    },
  );

  let printed: { kind: string; workItem: Record<string, unknown> };
  await when('the client runs "receive" on it', async () => {
    printed = (await box.json(["receive", file])) as typeof printed;
  });

  await then(
    'receive prints a work item that the contract accepts with the title "Fix the checkout button on Safari"',
    async () => {
      expect(printed.kind).toBe("work");
      expect(validate("work-item", printed.workItem)).toEqual([]);
      expect(printed.workItem.title).toBe("Fix the checkout button on Safari");
      expect(printed.workItem.description).toBe("Fix the checkout button on Safari");
      expect(printed.workItem.type).toBe("task");
    },
  );

  await then(
    "the work item names the person as its requester and the message's thread as its origin and dedupe key",
    async () => {
      const thread = `slack:${CHANNEL}:${ts}`;
      expect(printed.workItem.id).toBe(`${thread}/${ts}`);
      expect(printed.workItem.requester).toEqual({ kind: "person", id: `slack:${PERSON}`, displayName: "Varun" });
      expect(printed.workItem.dedupeKey).toBe(thread);
      expect(printed.workItem.origin).toMatchObject({ source: "slack", externalId: thread });
    },
  );

  await then("the work item's origin links to the message on the test chat", async () => {
    expect((printed.workItem.origin as { url: string }).url).toBe(
      `https://testkit.slack.com/archives/${CHANNEL}/p${ts.replace(".", "")}`,
    );
  });
});
