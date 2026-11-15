import { type Page, scenario } from "@opensoftware/testkit";
import { factoryRuns, LINEAR, propose, servingChanges } from "./changes.ts";

scenario("SCN-CONSOLE-217", async ({ sut, fakes, given, when, then }) => {
  await given('a console with a factory repository, and "grace@acme.dev" as "factory-engineer"', async () => {
    // The console checks the form before it reaches the repository, so the repository is never asked.
    await servingChanges(sut, fakes, {
      CONSOLE_FACTORY_REPOSITORY: "git+http://127.0.0.1:9/tester/factory.git#main",
      CONSOLE_FACTORY_USER: "forgejo:tester",
      CONSOLE_FACTORY_CACHE: sut.files.path("$OUTPUT/cache"),
    });
  });

  let sent: Page;
  await when(
    '"grace@acme.dev" sends the form "Propose change" with "add-egress", the agent "triage" and the value "https://api.linear.app/*"',
    async () => {
      sent = await propose(sut, { ...LINEAR, value: "https://api.linear.app/*" });
    },
  );

  await then(
    'the form answers 400 and says "Not proposed: https://api.linear.app/* is not a host name, like api.linear.app"',
    async () => {
      expect(sent.status).toBe(400);
      expect(sent.text).toContain("Not proposed: https://api.linear.app/* is not a host name, like api.linear.app");
    },
  );

  await then('the console ran no "factory edit"', async () => {
    expect(await factoryRuns(sut)).toEqual([]);
  });
});
