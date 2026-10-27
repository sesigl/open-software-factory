import { scenario } from "@opensoftware/testkit";
import { open, proposalForge, rows, servingInbox } from "./console.ts";

scenario("SCN-CONSOLE-034", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof proposalForge>>;
  await given('the forge\'s repository "tester/web" and the console\'s forge token "not-a-token"', async () => {
    box = await proposalForge(fakes, [
      { branch: "observer/triage-inline-1a2b3c4d", title: "Triage asks before it investigates" },
    ]);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/inbox"', async () => {
    await servingInbox(sut, fakes, box.forge, { CONSOLE_FORGE_TOKEN: "not-a-token" });
    page = await open(sut, "/inbox");
  });

  await then('the page answers 200 and says "the forge did not answer: the forge refused the token"', async () => {
    expect(page.status).toBe(200);
    expect(page.html).toContain('<p role="alert">the forge did not answer: the forge refused the token</p>');
    expect(rows(page.html)).toEqual([]);
  });
});
