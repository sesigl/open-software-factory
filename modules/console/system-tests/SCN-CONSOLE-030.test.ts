import { scenario } from "@opensoftware/testkit";
import { links, navLinks, open, proposalForge, rows, rowWith, servingInbox } from "./console.ts";

scenario("SCN-CONSOLE-030", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof proposalForge>>;
  await given(
    'the forge\'s repository "tester/web" with open pull requests from "observer/triage-inline-1a2b3c4d" titled "Triage asks before it investigates", from "fix-checkout" titled "Fix checkout button on Safari" and from "observer/review-scope-5e6f7a8b" titled "Review reads the scenario first", in this order',
    async () => {
      box = await proposalForge(fakes, [
        { branch: "observer/triage-inline-1a2b3c4d", title: "Triage asks before it investigates" },
        { branch: "fix-checkout", title: "Fix checkout button on Safari" },
        { branch: "observer/review-scope-5e6f7a8b", title: "Review reads the scenario first" },
      ]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/inbox"', async () => {
    await servingInbox(sut, fakes, box.forge);
    page = await open(sut, "/inbox");
  });

  await then(
    'the rows are "Review reads the scenario first" and "Triage asks before it investigates" in this order',
    async () => {
      expect(page.status).toBe(200);
      expect(rows(page.html).map((row) => row.slice(0, 3))).toEqual([
        ["Review reads the scenario first", "observer/review-scope-5e6f7a8b", "github:tester"],
        ["Triage asks before it investigates", "observer/triage-inline-1a2b3c4d", "github:tester"],
      ]);
    },
  );

  await then("each row links its pull request", async () => {
    const [triage, , review] = box.opened;
    expect(links(rowWith(page.html, "Review reads the scenario first"))).toEqual([
      { href: review?.url, text: "Review reads the scenario first" },
    ]);
    expect(links(rowWith(page.html, "Triage asks before it investigates"))).toEqual([
      { href: triage?.url, text: "Triage asks before it investigates" },
    ]);
  });

  await then('the page\'s navigation links "/inbox"', async () => {
    expect(navLinks(page.html)).toContainEqual({ href: "/inbox", text: "Inbox" });
  });
});
