import { type Forge, type Page, scenario } from "@opensoftware/testkit";
import { changesEnv, commitOf, FACTORY, factoryRepository, headOf } from "../changes.ts";
import { links } from "../console.ts";
import { agentTexts, editTexts, openSkill, servingSwitches } from "../switches.ts";

const SENTENCES = [
  "The factory declares the secrets provider openbao at ^0.",
  "The agent review gets the secret reference ref:openbao/linear-token.",
  "The agent review may reach the host api.linear.app.",
  "The agent review gets the skill ./skills/release-notes.",
];

const TITLE =
  "factory edit add-secrets-provider openbao ^0; add-secret review ref:openbao/linear-token; add-egress review api.linear.app; add-skill review ./skills/release-notes";

scenario("SCN-CONSOLE-234", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  let main: string;
  await given(
    'a factory repository "tester/factory" whose main branch requires the check "factory", and a console behind a sign-in proxy with "grace@acme.dev" as "factory-engineer"',
    async () => {
      forge = await factoryRepository(fakes);
      main = (await headOf(forge, "main")) as string;
    },
  );

  await given(
    'a factory that declares the secrets provider "env", whose agent "triage" uses the skill "release-notes", which needs "LINEAR_TOKEN" and the host "api.linear.app", and whose agent "review" has a sandbox that reaches only "api.github.com" and declares no secret',
    async () => {
      await servingSwitches(sut, fakes, changesEnv(sut, forge));
    },
  );

  let asked: Page;
  let sent: Page;
  await when(
    '"grace@acme.dev" opens "/skills/release-notes", presses "Switch on for review" and then "Propose change"',
    async () => {
      asked = await (await openSkill(sut)).submit("Switch on for review");
      sent = await asked.submit("Propose change", {}, { follow: false });
    },
  );

  await then(
    'the page that asked first said "Switch on release-notes for review?" and that an admin stores the value of each added secret on Secrets',
    async () => {
      expect([asked.status, asked.getByRole("heading", { level: 1 }).text]).toEqual([
        200,
        "Switch on release-notes for review?",
      ]);
      expect(
        asked
          .getByText(/^The console opens a pull request/)
          .text.endsWith(
            "review has the skill from its next run. An admin stores the value of each added secret on Secrets.",
          ),
      ).toBe(true);
    },
  );

  await then(
    'it listed "The factory declares the secrets provider openbao at ^0.", "The agent review gets the secret reference ref:openbao/linear-token.", "The agent review may reach the host api.linear.app." and "The agent review gets the skill ./skills/release-notes."',
    async () => {
      expect(editTexts(asked)).toEqual(SENTENCES);
    },
  );

  await then('the console answered 303 to "/changes"', async () => {
    expect([sent.status, sent.location]).toEqual([303, "/changes"]);
  });

  let head: string;
  await then(
    'the forge has one open pull request titled "factory edit add-secrets-provider openbao ^0; add-secret review ref:openbao/linear-token; add-egress review api.linear.app; add-skill review ./skills/release-notes" from a branch "console/add-skill-review-<the newest commit>-<hash of the edits>", whose body lists the four edits in these words',
    async () => {
      const pulls = await forge.pullRequests("factory");
      expect(pulls.map(({ title, state }) => ({ title, state }))).toEqual([{ title: TITLE, state: "open" }]);
      head = pulls[0]?.head ?? "";
      expect(head).toMatch(new RegExp(`^console/add-skill-review-${main.slice(0, 7)}-[0-9a-f]{8}$`));
      expect(pulls[0]?.body.split("\n").slice(0, 7)).toEqual([
        "The change makes these edits of the factory:",
        "",
        "- The factory declares the secrets provider `openbao` at `^0`.",
        "- The agent `review` gets the secret reference `ref:openbao/linear-token`.",
        "- The agent `review` may reach the host `api.linear.app`.",
        "- The agent `review` gets the skill `./skills/release-notes`.",
        "",
      ]);
    },
  );

  await then(
    'its one commit holds the factory.yaml that "factory edit" printed after the four edits, each run on the text of the one before',
    async () => {
      const commit = await commitOf(forge, (await headOf(forge, head)) as string);
      expect(commit.parents).toEqual([main]);
      expect(await forge.file("factory", "factory.yaml", head)).toBe(
        `${FACTORY}# add-secrets-provider openbao ^0\n# add-secret review ref:openbao/linear-token\n# add-egress review api.linear.app\n# add-skill review ./skills/release-notes\n`,
      );
    },
  );

  await then(
    '"/skills/release-notes" shows "review" "Switching on", "Checking" and the link to the pull request in place of the switch, and "triage" with "Switch off for triage"',
    async () => {
      const page = await openSkill(sut);
      const [pull] = await forge.pullRequests("factory");
      expect(agentTexts(page)).toEqual([
        `review Switching on Checking Pull request #${pull?.number}`,
        "triage Has what the skill needs Switch off for triage",
      ]);
      expect(links(page.getByRole("list", { name: "Agents" }))).toEqual([
        { href: pull?.url, text: `Pull request #${pull?.number}` },
      ]);
    },
  );
});
