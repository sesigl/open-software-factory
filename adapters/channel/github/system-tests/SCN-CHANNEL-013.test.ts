import { scenario } from "@opensoftware/testkit";
import { setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-013", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let card: Record<string, unknown>;
  await given('the client ran "ask" on a thread with "Merge pull request 12 into main?"', async () => {
    box = await setup(sut, fakes);
    card = await box.json(["ask", await thread(box), "Merge pull request 12 into main?"]);
  });

  let file = "";
  await given('a delivery of the person choosing "approve" on that card', async () => {
    file = await box.delivery(await box.github.say(box.pr, "/approve"));
  });

  let printed: Record<string, unknown>;
  await when('the client runs "receive" on it', async () => {
    printed = await box.json(["receive", file]);
  });

  await then("the decision's time is an RFC 3339 time in UTC that is not before the card's time", async () => {
    const time = String(printed.time);
    expect(time).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(time >= String(card.time)).toBe(true);
  });
});
