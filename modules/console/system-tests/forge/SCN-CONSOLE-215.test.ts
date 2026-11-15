import { type Forge, type Page, scenario } from "@opensoftware/testkit";
import { changesEnv, factoryRepository, propose, servingChanges } from "../changes.ts";

scenario("SCN-CONSOLE-215", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given(
    'a factory repository "tester/factory" whose main branch has no rules, and a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer"',
    async () => {
      forge = await factoryRepository(fakes, false);
      await servingChanges(sut, fakes, changesEnv(sut, forge));
    },
  );

  let sent: Page;
  await when('"grace@acme.dev" sends the form "Propose change"', async () => {
    sent = await propose(sut);
  });

  await then(
    'the form answers 409 and says "Not proposed: the branch main of tester/factory does not require the check factory, so nothing would check the change before it merges. Require the check factory on main first."',
    async () => {
      expect(sent.status).toBe(409);
      expect(sent.text).toContain(
        "Not proposed: the branch main of tester/factory does not require the check factory, so nothing would check the change before it merges. Require the check factory on main first.",
      );
    },
  );

  await then('the forge has no pull request and only the branch "main"', async () => {
    expect(await forge.pullRequests("factory")).toEqual([]);
    expect((await forge.branches("factory")).map((branch) => branch.name)).toEqual(["main"]);
  });
});
