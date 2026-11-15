import { scenario } from "@opensoftware/testkit";
import { type Catalog, putSkill, putSkilled, skillMd } from "./skills.ts";

scenario("SCN-FSPEC-116", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has the skills "./skills/release-notes" and "./skills/missing"',
    async () => {
      await putSkilled(sut, ["./skills/release-notes", "./skills/missing"]);
    },
  );

  await given(
    'the SKILL.md of "release-notes" has the front matter "name: release-notes" and no description',
    async () => {
      await putSkill(sut, "skills/release-notes", skillMd(["name: release-notes"]));
    },
  );

  await given('the folder "skills/missing" holds only "README.md"', async () => {
    await putSkill(sut, "skills/missing", "# Missing\n", "README.md");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  let catalog: Catalog;
  await when('the console runs "factory skills"', async () => {
    run = await sut.cli(["skills"]);
    catalog = JSON.parse(run.stdout) as Catalog;
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  const skill = (name: string) => catalog.skills.find((each) => each.name === name);
  await then(
    '"release-notes" has no description, its Markdown and the problem "skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it"',
    async () => {
      expect(skill("release-notes")).toMatchObject({
        description: null,
        body: "\n# Release notes\n",
        problems: [
          "skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it",
        ],
      });
    },
  );

  await then(
    '"missing" has no description, no Markdown, the file "README.md" and the problem "the skill \\"./skills/missing\\" has no SKILL.md"',
    async () => {
      expect(skill("missing")).toMatchObject({
        description: null,
        body: null,
        files: ["README.md"],
        needs: { secrets: [], hosts: [] },
        problems: ['the skill "./skills/missing" has no SKILL.md'],
      });
    },
  );
});
