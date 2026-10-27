import { scenario } from "@opensoftware/testkit";
import { open, proposalForge, rows, servingInbox } from "./console.ts";

scenario("SCN-CONSOLE-033", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof proposalForge>>;
  await given(
    'the forge\'s repository "tester/web" with open pull requests from "improve/triage-1a2b3c4d" titled "Triage asks before it investigates" and from "observer/review-scope-5e6f7a8b" titled "Review reads the scenario first"',
    async () => {
      box = await proposalForge(fakes, [
        { branch: "improve/triage-1a2b3c4d", title: "Triage asks before it investigates" },
        { branch: "observer/review-scope-5e6f7a8b", title: "Review reads the scenario first" },
      ]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/inbox" with "CONSOLE_INBOX_PREFIX" set to "improve/"', async () => {
    await servingInbox(sut, fakes, box.forge, { CONSOLE_INBOX_PREFIX: "improve/" });
    page = await open(sut, "/inbox");
  });

  await then('the rows are only "Triage asks before it investigates"', async () => {
    expect(rows(page.html).map((cells) => cells[0])).toEqual(["Triage asks before it investigates"]);
  });
});
