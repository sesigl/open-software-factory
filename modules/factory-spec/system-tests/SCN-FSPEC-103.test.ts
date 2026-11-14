import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled, skillMd } from "./skills.ts";

scenario("SCN-FSPEC-103", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has the skills "./skills/release-notes" and "./skills/changelog"',
    async () => {
      await putSkilled(sut, ["./skills/release-notes", "./skills/changelog"]);
    },
  );

  await given('the SKILL.md of "release-notes" repeats the key "name" on line 3', async () => {
    const front = ["name: release-notes", "name: release-notes", "description: Write the release notes."];
    await putSkill(sut, "skills/release-notes", skillMd(front));
  });

  await given('the front matter of "changelog" is the list "- changelog"', async () => {
    await putSkill(sut, "skills/changelog", skillMd(["- changelog"]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "skills/release-notes/SKILL.md:3:1 Map keys must be unique", "skills/changelog/SKILL.md:2:1 the skill has no name: write \\"name: changelog\\", the name of its folder", "skills/changelog/SKILL.md:2:1 the skill has no description: say what it does and when to use it" and then "factory.yaml: 3 problems"',
    async () => {
      expect(run.stdout).toBe(
        [
          "skills/release-notes/SKILL.md:3:1 Map keys must be unique",
          'skills/changelog/SKILL.md:2:1 the skill has no name: write "name: changelog", the name of its folder',
          "skills/changelog/SKILL.md:2:1 the skill has no description: say what it does and when to use it",
          "factory.yaml: 3 problems",
          "",
        ].join("\n"),
      );
    },
  );
});
