import { scenario } from "@opensoftware/testkit";
import { open, proposalForge, rows, servingInbox } from "./console.ts";

scenario("SCN-CONSOLE-031", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof proposalForge>>;
  await given(
    'the forge\'s repository "tester/web" with the proposal "Triage asks before it investigates" that the person "reviewer" approved and the proposal "Review reads the scenario first" that nobody reviewed, both opened on "2026-01-01"',
    async () => {
      box = await proposalForge(fakes, [
        { branch: "observer/triage-inline-1a2b3c4d", title: "Triage asks before it investigates" },
        { branch: "observer/review-scope-5e6f7a8b", title: "Review reads the scenario first" },
      ]);
      await box.forge.review(box.opened[0] as (typeof box.opened)[number], "APPROVED", "Good change");
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/inbox" at "2026-01-03T12:00:00Z"', async () => {
    await servingInbox(sut, fakes, box.forge, { OSF_NOW: "2026-01-03T12:00:00Z" });
    page = await open(sut, "/inbox");
  });

  const row = (title: string) => rows(page.html).find((cells) => cells[0] === title);

  await then('the row of "Triage asks before it investigates" shows "approved" and the age "2 d"', async () => {
    expect(row("Triage asks before it investigates")?.slice(3)).toEqual(["approved", "2 d"]);
  });

  await then('the row of "Review reads the scenario first" shows "needs review" and the age "2 d"', async () => {
    expect(row("Review reads the scenario first")?.slice(3)).toEqual(["needs review", "2 d"]);
  });
});
