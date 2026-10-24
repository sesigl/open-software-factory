import { scenario } from "@opensoftware/testkit";
import { setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-006", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let id = "";
  await given("a work item that receive printed for the person's message", async () => {
    box = await setup(sut, fakes);
    id = await thread(box);
  });

  let printed: Record<string, unknown>;
  await when('the client runs "ask" on its thread with "Merge pull request 12 into main?"', async () => {
    printed = await box.json(["ask", id, "Merge pull request 12 into main?"]);
  });

  await then(
    'the test chat shows the bot\'s card in that thread with "Merge pull request 12 into main?" and the choices "approve" and "reject"',
    async () => {
      const [, card] = await box.github.conversation(box.pr);
      expect(card?.user).toBe(box.github.owner);
      expect(card?.body).toContain("Merge pull request 12 into main?");
      expect(card?.body).toContain("Answer with /approve or /reject.");
    },
  );

  await then("ask prints the thread and the card's ID", async () => {
    const [, card] = await box.github.conversation(box.pr);
    expect(printed).toEqual({ thread: id, id: String(card?.id) });
  });
});
