import { type Page, scenario } from "@opensoftware/testkit";
import { servingOpen, skillOf, skillRows } from "./skills.ts";

const REPOSITORY = "https://github.com/acme/skills.git";
const PROBLEM = `factory.lock has no pin of the skill "changelog" for "git+${REPOSITORY}#v1.2:skills/changelog": run "factory plan"`;
const PINNED = `skills/release-notes in ${REPOSITORY} at 7c2e91d`;
const UNPINNED = `skills/changelog in ${REPOSITORY}, not pinned in factory.lock`;

scenario("SCN-CONSOLE-240", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the skill "release-notes" of "https://github.com/acme/skills.git" pinned at "7c2e91d4f0b3a8c6e5d2f1a0b9c8d7e6f5a4b3c2", and the skill "changelog" of the same repository without a pin, with its problem',
    async () => {
      const pinned = skillOf(
        "release-notes",
        { triage: {} },
        {
          source: {
            folder: "skills/release-notes",
            repository: REPOSITORY,
            commit: "7c2e91d4f0b3a8c6e5d2f1a0b9c8d7e6f5a4b3c2",
          },
        },
      );
      // Without a pin the catalog has no commit, no files and no body, and the missing pin as its problem.
      const unpinned = skillOf(
        "changelog",
        { triage: {} },
        {
          description: null,
          source: { folder: "skills/changelog", repository: REPOSITORY },
          files: [],
          body: null,
          problems: [PROBLEM],
        },
      );
      await servingOpen(sut, fakes, { triage: {} }, [unpinned, pinned]);
    },
  );

  let list: Page;
  let pinned: Page;
  let unpinned: Page;
  await when('a person opens "/skills", "/skills/release-notes" and "/skills/changelog"', async () => {
    [list, pinned, unpinned] = await Promise.all([
      sut.pages.open("/skills"),
      sut.pages.open("/skills/release-notes"),
      sut.pages.open("/skills/changelog"),
    ]);
  });

  await then(
    'the list says "skills/release-notes in https://github.com/acme/skills.git at 7c2e91d" and "skills/changelog in https://github.com/acme/skills.git, not pinned in factory.lock" with "Fails factory lint"',
    async () => {
      const rows = skillRows(list);
      expect(rows["release-notes"]).toContain(`${PINNED} · Used by the agent triage`);
      expect(rows.changelog).toContain(`${UNPINNED} · Used by the agent triage`);
      expect(rows.changelog).toContain("Fails factory lint");
    },
  );

  await then(
    'the page of "release-notes" says "skills/release-notes in https://github.com/acme/skills.git at 7c2e91d"',
    async () => {
      expect(pinned.getByText(PINNED).text).toBe(PINNED);
    },
  );

  await then(
    'the page of "changelog" says "skills/changelog in https://github.com/acme/skills.git, not pinned in factory.lock" and its problem',
    async () => {
      expect(unpinned.getByText(UNPINNED).text).toBe(UNPINNED);
      expect(unpinned.getByRole("alert").text).toBe(`factory lint: ${PROBLEM}`);
    },
  );
});
