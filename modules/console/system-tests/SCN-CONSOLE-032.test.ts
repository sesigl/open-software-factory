import { scenario } from "@opensoftware/testkit";
import { open, proposalForge, rows, servingInbox } from "./console.ts";

scenario("SCN-CONSOLE-032", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof proposalForge>>;
  await given(
    'the forge\'s repository "tester/web" with the proposal "Triage asks before it investigates" on which the person "reviewer" asked for changes',
    async () => {
      box = await proposalForge(fakes, [
        { branch: "observer/triage-inline-1a2b3c4d", title: "Triage asks before it investigates" },
      ]);
      await box.forge.review(box.opened[0] as (typeof box.opened)[number], "REQUEST_CHANGES", "Name the scenario");
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/inbox"', async () => {
    await servingInbox(sut, fakes, box.forge);
    page = await open(sut, "/inbox");
  });

  await then('the row of "Triage asks before it investigates" shows "changes requested"', async () => {
    expect(rows(page.html).map((cells) => [cells[0], cells[3]])).toEqual([
      ["Triage asks before it investigates", "changes requested"],
    ]);
  });
});
