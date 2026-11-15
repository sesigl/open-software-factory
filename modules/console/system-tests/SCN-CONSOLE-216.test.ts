import { type Page, scenario } from "@opensoftware/testkit";
import { openChanges, propose, servingChanges } from "./changes.ts";

const LOCAL =
  "This factory is read from a local folder, so the console cannot change it. Set CONSOLE_FACTORY_REPOSITORY to its repository on a forge.";

scenario("SCN-CONSOLE-216", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer", without "CONSOLE_FACTORY_REPOSITORY"',
    async () => {
      await servingChanges(sut, fakes, {});
    },
  );

  let page: Page;
  let sent: Page;
  await when('"grace@acme.dev" opens "/changes" and sends the form "Propose change"', async () => {
    page = await openChanges(sut);
    sent = await propose(sut);
  });

  await then(
    'the page says "This factory is read from a local folder, so the console cannot change it. Set CONSOLE_FACTORY_REPOSITORY to its repository on a forge." and has no form "Propose a change"',
    async () => {
      expect(page.status).toBe(200);
      expect(page.getByText(LOCAL).text).toBe(LOCAL);
      expect(page.forms.map((form) => form.name)).not.toContain("Propose a change");
    },
  );

  await then("the form answers 404 and says the same", async () => {
    expect(sent.status).toBe(404);
    expect(sent.text).toContain(LOCAL);
  });
});
