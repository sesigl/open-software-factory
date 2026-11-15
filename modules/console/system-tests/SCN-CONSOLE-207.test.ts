import { type Page, scenario } from "@opensoftware/testkit";
import { factoryRuns, openChanges, propose, servingChanges, unreachableEnv } from "./changes.ts";

const MEMBER = { "x-forwarded-email": "varun@acme.dev" };

scenario("SCN-CONSOLE-207", async ({ sut, fakes, given, when, then }) => {
  await given('a console with a factory repository, and "varun@acme.dev" as "member"', async () => {
    // The console refuses the form before it asks the forge or the repository.
    await servingChanges(sut, fakes, unreachableEnv(sut));
  });

  let sent: Page;
  let page: Page;
  await when('"varun@acme.dev" sends the form "Propose change" and opens "/changes"', async () => {
    sent = await propose(sut, undefined, MEMBER);
    page = await openChanges(sut, MEMBER);
  });

  await then(
    'the form answers 403 and says "varun@acme.dev has the role member: a change needs the role admin or factory-engineer"',
    async () => {
      expect(sent.status).toBe(403);
      expect(sent.text).toContain("varun@acme.dev has the role member: a change needs the role admin or factory-engineer");
    },
  );

  await then('the console ran no "factory edit"', async () => {
    expect(await factoryRuns(sut)).toEqual([]);
  });

  await then('"/changes" has no form "Propose a change"', async () => {
    expect(page.status).toBe(200);
    expect(page.getByRole("heading", { level: 1 }).text).toBe("Changes");
    expect(page.forms.map((form) => form.name)).not.toContain("Propose a change");
  });
});
