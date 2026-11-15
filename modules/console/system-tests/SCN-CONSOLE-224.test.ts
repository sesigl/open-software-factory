import { type Page, scenario } from "@opensoftware/testkit";
import { factoryRuns, LINEAR, propose, servingChanges, unreachableEnv } from "./changes.ts";

scenario("SCN-CONSOLE-224", async ({ sut, fakes, given, when, then }) => {
  await given('a console with a factory repository, and "grace@acme.dev" as "factory-engineer"', async () => {
    // The console checks the form before it reaches the repository, so the repository is never asked.
    await servingChanges(sut, fakes, unreachableEnv(sut));
  });

  let sent: Page;
  await when(
    '"grace@acme.dev" sends the form "Propose change" with "add-egress", the agent "triage main" and the value "api.linear.app"',
    async () => {
      sent = await propose(sut, { ...LINEAR, agent: "triage main" });
    },
  );

  await then(
    'the form answers 400 and says "Not proposed: triage main is not an agent\'s name, like triage"',
    async () => {
      expect(sent.status).toBe(400);
      expect(sent.text).toContain("Not proposed: triage main is not an agent's name, like triage");
    },
  );

  await then('the console ran no "factory edit"', async () => {
    expect(await factoryRuns(sut)).toEqual([]);
  });
});
