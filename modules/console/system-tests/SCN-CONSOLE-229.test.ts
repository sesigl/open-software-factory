import { type Page, scenario } from "@opensoftware/testkit";
import { factoryRuns, propose, servingChanges, unreachableEnv } from "./changes.ts";

const agent = (edit: string, value: string) => ({ edit, agent: "triage", value });

/** One form of each kind of value that the console takes, the last with spaces around its fields. */
const FORMS: Record<string, string>[] = [
  agent("add-skill", "./skills/release-notes"),
  agent("remove-skill", "skills/release-notes"),
  agent("add-secret", "ref:openbao/linear-token"),
  agent("remove-secret", "ref:env/SLACK_TOKEN"),
  agent("remove-egress", "api.github.com"),
  { edit: "add-secrets-provider", name: "vault", range: "1" },
  { edit: " add-egress ", agent: " triage ", value: " api.linear.app " },
];

scenario("SCN-CONSOLE-229", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with a factory repository at "http://127.0.0.1:9/tester/factory.git" that does not answer, and "grace@acme.dev" as "factory-engineer"',
    async () => {
      await servingChanges(sut, fakes, unreachableEnv(sut));
    },
  );

  let sent: Page[] = [];
  await when(
    '"grace@acme.dev" sends the form "Propose change" with "add-skill" and "./skills/release-notes", "remove-skill" and "skills/release-notes", "add-secret" and "ref:openbao/linear-token", "remove-secret" and "ref:env/SLACK_TOKEN", "remove-egress" and "api.github.com", "add-secrets-provider" with the name "vault" at the range "1", and " add-egress " with the agent " triage " and the value " api.linear.app "',
    async () => {
      sent = await Promise.all(FORMS.map((fields) => propose(sut, fields)));
    },
  );

  await then(
    'each form answers 502 and says "Not proposed: cannot fetch main of http://127.0.0.1:9/tester/factory.git": the console asked the repository, which does not answer',
    async () => {
      expect(sent.map((page) => page.status)).toEqual(FORMS.map(() => 502));
      expect(sent.map((page) => page.text)).toEqual(
        FORMS.map(() =>
          expect.stringContaining("Not proposed: cannot fetch main of http://127.0.0.1:9/tester/factory.git"),
        ),
      );
    },
  );

  await then('the console ran no "factory edit"', async () => {
    expect(await factoryRuns(sut)).toEqual([]);
  });
});
