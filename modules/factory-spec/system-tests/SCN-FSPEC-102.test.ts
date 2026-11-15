import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled } from "./skills.ts";

scenario("SCN-FSPEC-102", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the skill "./skills/release-notes"', async () => {
    await putSkilled(sut, ["./skills/release-notes"]);
  });

  await given('its SKILL.md is "# Release notes"', async () => {
    await putSkill(sut, "skills/release-notes", "# Release notes\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "skills/release-notes/SKILL.md:1:1 SKILL.md has no front matter: it starts with a line \\"---\\", the fields name and description and a line \\"---\\"" and then "factory.yaml: 1 problems"',
    async () => {
      expect(run.stdout).toBe(
        'skills/release-notes/SKILL.md:1:1 SKILL.md has no front matter: it starts with a line "---", the fields name and description and a line "---"\n' +
          "factory.yaml: 1 problems\n",
      );
    },
  );
});
