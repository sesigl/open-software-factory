import { type Forge, type Page, scenario } from "@opensoftware/testkit";
import { changesEnv, changeTexts, factoryRepository, openChanges, pullRequestOf, servingChanges } from "../changes.ts";

/** The title of each pull request, with the sentence of its edit. */
const EDITS: [string, string][] = [
  ["factory edit add-skill triage ./skills/release-notes", "The agent triage gets the skill ./skills/release-notes."],
  [
    "factory edit remove-skill triage skills/release-notes",
    "The agent triage no longer has the skill skills/release-notes.",
  ],
  [
    "factory edit add-secret triage ref:openbao/linear-token",
    "The agent triage gets the secret reference ref:openbao/linear-token.",
  ],
  [
    "factory edit remove-secret triage ref:env/SLACK_TOKEN",
    "The agent triage no longer has the secret reference ref:env/SLACK_TOKEN.",
  ],
  ["factory edit remove-egress triage api.github.com", "The agent triage may no longer reach the host api.github.com."],
  ["factory edit add-secrets-provider vault 1", "The factory declares the secrets provider vault at 1."],
];

/** What the page says of a change before the state of its check. */
const before = (text: string): string => text.split(" Waits for the check factory;")[0] as string;

scenario("SCN-CONSOLE-226", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given(
    'a factory repository "tester/factory" and a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer"',
    async () => {
      forge = await factoryRepository(fakes);
      await servingChanges(sut, fakes, changesEnv(sut, forge));
    },
  );

  await given(
    'the console\'s user opened pull requests from "console/" branches with the titles "factory edit add-skill triage ./skills/release-notes", "factory edit remove-skill triage skills/release-notes", "factory edit add-secret triage ref:openbao/linear-token", "factory edit remove-secret triage ref:env/SLACK_TOKEN", "factory edit remove-egress triage api.github.com" and "factory edit add-secrets-provider vault 1"',
    async () => {
      // One after the other: the page lists the newest first.
      for (const [index, [title]] of EDITS.entries())
        await pullRequestOf(forge, title, `console/earlier-${index}`, `host-${index}.example`);
    },
  );

  let page: Page;
  await when('"grace@acme.dev" opens "/changes"', async () => {
    page = await openChanges(sut);
  });

  await then(
    'the changes read "The agent triage gets the skill ./skills/release-notes.", "The agent triage no longer has the skill skills/release-notes.", "The agent triage gets the secret reference ref:openbao/linear-token.", "The agent triage no longer has the secret reference ref:env/SLACK_TOKEN.", "The agent triage may no longer reach the host api.github.com." and "The factory declares the secrets provider vault at 1."',
    async () => {
      expect(changeTexts(page).map(before).reverse()).toEqual(EDITS.map(([, sentence]) => sentence));
    },
  );
});
