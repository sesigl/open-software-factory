import { type Page, scenario } from "@opensoftware/testkit";
import { unreachableEnv } from "./changes.ts";
import { editTexts, openSkill, servingSwitches } from "./switches.ts";

scenario("SCN-CONSOLE-238", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a console with a factory repository at "http://127.0.0.1:9/tester/factory.git" that does not answer, and "grace@acme.dev" as "factory-engineer"',
    async () => {
      env = unreachableEnv(sut);
    },
  );

  await given(
    'a factory whose agent "triage" uses the skill "release-notes" as "./skills/release-notes" with what it needs',
    async () => {
      await servingSwitches(sut, fakes, env);
    },
  );

  let asked: Page;
  let sent: Page;
  await when(
    '"grace@acme.dev" presses "Switch off for triage" on "/skills/release-notes" and then "Propose change"',
    async () => {
      asked = await (await openSkill(sut)).submit("Switch off for triage");
      sent = await asked.submit("Propose change", {}, { follow: false });
    },
  );

  await then(
    'the page that asked first said "Switch off release-notes for triage?" and "The console opens a pull request with these edits on the factory\'s repository. The forge merges it when its check factory passes, and triage no longer has the skill from its next run."',
    async () => {
      expect(asked.getByRole("heading", { level: 1 }).text).toBe("Switch off release-notes for triage?");
      const effect = asked.getByText(/^The console opens a pull request/).text;
      expect(effect).toBe(
        "The console opens a pull request with these edits on the factory's repository. The forge merges it when its check factory passes, and triage no longer has the skill from its next run.",
      );
    },
  );

  await then('it listed only "The agent triage no longer has the skill ./skills/release-notes."', async () => {
    expect(editTexts(asked)).toEqual(["The agent triage no longer has the skill ./skills/release-notes."]);
  });

  await then(
    'the form answered 502 and said "Not proposed: cannot fetch main of http://127.0.0.1:9/tester/factory.git": its edit passed the checks of a form',
    async () => {
      expect(sent.status).toBe(502);
      expect(sent.text).toContain("Not proposed: cannot fetch main of http://127.0.0.1:9/tester/factory.git");
    },
  );
});
