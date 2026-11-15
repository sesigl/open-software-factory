import { type Forge, type Page, scenario } from "@opensoftware/testkit";
import { changesEnv, factoryRepository, openChanges, propose, servingChanges } from "./changes.ts";

const MEMBER = { "x-forwarded-email": "varun@acme.dev" };

scenario("SCN-CONSOLE-207", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given(
    'a factory repository "tester/factory" whose main branch requires the check "factory", and a console behind a sign-in proxy with "varun@acme.dev" as "member"',
    async () => {
      forge = await factoryRepository(sut, fakes);
      await servingChanges(sut, fakes, changesEnv(sut, forge));
    },
  );

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
      expect(sent.text).toContain(
        "varun@acme.dev has the role member: a change needs the role admin or factory-engineer",
      );
    },
  );

  await then("the forge has no pull request", async () => {
    expect(await forge.pullRequests("factory")).toEqual([]);
  });

  await then('"/changes" has no form "Propose a change"', async () => {
    expect(page.status).toBe(200);
    expect(page.getByRole("heading", { level: 1 }).text).toBe("Changes");
    expect(page.forms.map((form) => form.name)).not.toContain("Propose a change");
  });
});
