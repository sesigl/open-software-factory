import { scenario } from "@opensoftware/testkit";
import { mention, setup } from "./channel.ts";

scenario("SCN-CGITHUB-003", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let file = "";
  await given(
    'a delivery of the person\'s comment that mentions the bot with "Fix the checkout button on Safari   " and the next line "It does not react"',
    async () => {
      box = await setup(sut, fakes);
      file = (await mention(box, "Fix the checkout button on Safari   \nIt does not react")).file;
    },
  );

  let printed: { workItem: Record<string, unknown> };
  await when('the client runs "receive" on it', async () => {
    printed = (await box.json(["receive", file])) as typeof printed;
  });

  await then(
    'receive prints a work item with the title "Fix the checkout button on Safari" and both lines as its description',
    async () => {
      expect(printed.workItem.title).toBe("Fix the checkout button on Safari");
      expect(printed.workItem.description).toBe("Fix the checkout button on Safari   \nIt does not react");
    },
  );
});
