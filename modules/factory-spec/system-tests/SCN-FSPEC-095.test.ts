import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled, skillMd } from "./skills.ts";

scenario("SCN-FSPEC-095", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the skill "./skills/release-notes"', async () => {
    await putSkilled(sut, ["./skills/release-notes"]);
  });

  await given('its SKILL.md has the front matter "name: release-notes" and no description', async () => {
    await putSkill(sut, "skills/release-notes", skillMd(["name: release-notes"]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it" and then "factory.yaml: 1 problems"',
    async () => {
      expect(run.stdout).toBe(
        "skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it\n" +
          "factory.yaml: 1 problems\n",
      );
    },
  );
});
