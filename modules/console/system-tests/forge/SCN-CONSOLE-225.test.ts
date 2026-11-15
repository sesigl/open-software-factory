import { type Forge, type Page, scenario } from "@opensoftware/testkit";
import { changesEnv, factoryRepository, propose, servingChanges } from "../changes.ts";

scenario("SCN-CONSOLE-225", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given(
    'a factory repository "tester/factory" whose main branch requires the check "factory", and a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer"',
    async () => {
      forge = await factoryRepository(fakes);
      await servingChanges(sut, fakes, changesEnv(sut, forge));
    },
  );

  let refused: Page;
  let sent: Page;
  await when(
    '"grace@acme.dev" sends the form "Declare a secrets provider" with the name "infisical" and the range "^1 || ^2", and then with the range "^1"',
    async () => {
      refused = await propose(sut, { edit: "add-secrets-provider", name: "infisical", range: "^1 || ^2" });
      sent = await propose(sut, { edit: "add-secrets-provider", name: "infisical", range: "^1" });
    },
  );

  await then('the first form answers 400 and says "Not proposed: ^1 || ^2 is not a range, like ^0"', async () => {
    expect(refused.status).toBe(400);
    expect(refused.text).toContain("Not proposed: ^1 || ^2 is not a range, like ^0");
  });

  await then('the second answers 303 to "/changes"', async () => {
    expect([sent.status, sent.location]).toEqual([303, "/changes"]);
  });

  await then(
    'the forge has one open pull request titled "factory edit add-secrets-provider infisical ^1", whose body says "The factory declares the secrets provider `infisical` at `^1`."',
    async () => {
      const pulls = await forge.pullRequests("factory");
      expect(pulls.map(({ title, state, base }) => ({ title, state, base }))).toEqual([
        { title: "factory edit add-secrets-provider infisical ^1", state: "open", base: "main" },
      ]);
      expect(pulls[0]?.head).toMatch(/^console\/add-secrets-provider-infisical-[0-9a-f]{7}-[0-9a-f]{8}$/);
      expect(pulls[0]?.body).toContain("The factory declares the secrets provider `infisical` at `^1`.");
    },
  );
});
