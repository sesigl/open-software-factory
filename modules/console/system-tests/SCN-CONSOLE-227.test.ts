import { type Page, scenario } from "@opensoftware/testkit";
import { factoryRuns, propose, servingChanges, unreachableEnv } from "./changes.ts";

const EDITS = "add-skill, remove-skill, add-secret, remove-secret, add-egress, remove-egress, add-secrets-provider";

/** The forms without an edit or an agent, with what each says. */
const FIRST: [Record<string, string>, string][] = [
  [{ edit: "delete-agent", agent: "triage", value: "api.linear.app" }, `delete-agent is not an edit: ${EDITS}`],
  [{ agent: "triage", value: "api.linear.app" }, `no edit is not an edit: ${EDITS}`],
  [{ edit: "add-skill", value: "skills/release-notes" }, "nothing is not an agent's name, like triage"],
];

const skill = (value: string): [Record<string, string>, string] => [
  { edit: "add-skill", agent: "triage", value },
  `${value} is not a skill folder, like skills/release-notes`,
];
const secret = (value: string): [Record<string, string>, string] => [
  { edit: "add-secret", agent: "triage", value },
  `${value} is not a secret reference, like ref:openbao/linear-token`,
];
const provider = (name: string): [Record<string, string>, string] => [
  { edit: "add-secrets-provider", name, range: "^0" },
  `${name} is not a provider's name, like openbao`,
];

/** The forms whose value or name the console refuses, with what each says. */
const OTHERS: [Record<string, string>, string][] = [
  ...["../outside", "skills/../outside", "!skills/notes", "skills/notes!"].map(skill),
  ...["linear-token", "xref:openbao/linear-token", "ref:openbao/linear-token!"].map(secret),
  ...["Vault", "9vault", "vault!"].map(provider),
  [{ edit: "add-secrets-provider", name: "vault", range: "latest" }, "latest is not a range, like ^0"],
];

scenario("SCN-CONSOLE-227", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console with a factory repository at "http://127.0.0.1:9/tester/factory.git" that does not answer, and "grace@acme.dev" as "factory-engineer"',
    async () => {
      await servingChanges(sut, fakes, unreachableEnv(sut));
    },
  );

  const send = (forms: [Record<string, string>, string][]) =>
    Promise.all(forms.map(([fields]) => propose(sut, fields)));

  let first: Page[] = [];
  await when(
    '"grace@acme.dev" sends the form "Propose change" with the edit "delete-agent", with no edit, and with "add-skill" and no agent',
    async () => {
      first = await send(FIRST);
    },
  );

  let others: Page[] = [];
  await when(
    'with "add-skill" and each of the values "../outside", "skills/../outside", "!skills/notes" and "skills/notes!"',
    async () => {
      others = await send(OTHERS.slice(0, 4));
    },
  );

  await when(
    'with "add-secret" and each of the values "linear-token", "xref:openbao/linear-token" and "ref:openbao/linear-token!"',
    async () => {
      others = [...others, ...(await send(OTHERS.slice(4, 7)))];
    },
  );

  await when(
    'with "add-secrets-provider" and each of the names "Vault", "9vault" and "vault!" at the range "^0", and the name "vault" at the range "latest"',
    async () => {
      others = [...others, ...(await send(OTHERS.slice(7)))];
    },
  );

  await then("each form answers 400", async () => {
    expect([...first, ...others].map((page) => page.status)).toEqual([...FIRST, ...OTHERS].map(() => 400));
  });

  await then(
    'the first three say "Not proposed: delete-agent is not an edit: add-skill, remove-skill, add-secret, remove-secret, add-egress, remove-egress, add-secrets-provider", "Not proposed: no edit is not an edit: add-skill, remove-skill, add-secret, remove-secret, add-egress, remove-egress, add-secrets-provider" and "Not proposed: nothing is not an agent\'s name, like triage"',
    async () => {
      expect(first.map((page) => page.text)).toEqual(
        FIRST.map(([, reason]) => expect.stringContaining(`Not proposed: ${reason}`)),
      );
    },
  );

  await then(
    'the others say "Not proposed: <value> is not a skill folder, like skills/release-notes", "Not proposed: <value> is not a secret reference, like ref:openbao/linear-token", "Not proposed: <name> is not a provider\'s name, like openbao" and "Not proposed: latest is not a range, like ^0"',
    async () => {
      expect(others.map((page) => page.text)).toEqual(
        OTHERS.map(([, reason]) => expect.stringContaining(`Not proposed: ${reason}`)),
      );
    },
  );

  await then('the console ran no "factory edit"', async () => {
    expect(await factoryRuns(sut)).toEqual([]);
  });
});
