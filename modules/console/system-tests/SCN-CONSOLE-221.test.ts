import { type Page, scenario } from "@opensoftware/testkit";
import { factoryRuns, propose, servingChanges, unreachableEnv } from "./changes.ts";

scenario("SCN-CONSOLE-221", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with a factory repository at "http://127.0.0.1:9/tester/factory.git" that does not answer, and "grace@acme.dev" as "factory-engineer"',
    async () => {
      await servingChanges(sut, fakes, unreachableEnv(sut));
    },
  );

  let sent: Page;
  await when('"grace@acme.dev" sends the form "Propose change"', async () => {
    sent = await propose(sut);
  });

  await then(
    'the form answers 502 and says "Not proposed: cannot fetch main of http://127.0.0.1:9/tester/factory.git"',
    async () => {
      expect(sent.status).toBe(502);
      expect(sent.text).toContain("Not proposed: cannot fetch main of http://127.0.0.1:9/tester/factory.git");
    },
  );

  await then('the console ran no "factory edit"', async () => {
    expect(await factoryRuns(sut)).toEqual([]);
  });
});
