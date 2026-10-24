import { validate } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { mention, PERSON, setup } from "./channel.ts";

scenario("SCN-CHANNEL-001", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let file = "";
  let comment = 0;
  await given(
    'a delivery of the person\'s message that mentions the bot with "Fix the checkout button on Safari"',
    async () => {
      box = await setup(sut, fakes);
      const delivered = await mention(box);
      file = delivered.file;
      comment = delivered.comment.id;
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
      expect(printed.workItem.id).toBe(`${box.thread}/${comment}`);
      expect(printed.workItem.requester).toEqual({ kind: "person", id: `github:${PERSON}`, displayName: PERSON });
      expect(printed.workItem.dedupeKey).toBe(box.thread);
      expect(printed.workItem.origin).toMatchObject({ source: "github", externalId: box.thread });
    },
  );

  await then("the work item's origin links to the message on the test chat", async () => {
    expect((printed.workItem.origin as { url: string }).url).toBe(`${box.pr.url}#issuecomment-${comment}`);
  });
});
