import { scenario } from "@opensoftware/testkit";
import { named, putSkill, putSkilled } from "./skills.ts";

scenario("SCN-FSPEC-105", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the skill "./skills/release-notes"', async () => {
    await putSkilled(sut, ["./skills/release-notes"]);
  });

  await given('its SKILL.md has the name "changelog" on line 2', async () => {
    await putSkill(sut, "skills/release-notes", named("changelog"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "skills/release-notes/SKILL.md:2:1 name \\"changelog\\" is not \\"release-notes\\", the name of its folder" and then "factory.yaml: 1 problems"',
    async () => {
      expect(run.stdout).toBe(
        'skills/release-notes/SKILL.md:2:1 name "changelog" is not "release-notes", the name of its folder\n' +
          "factory.yaml: 1 problems\n",
      );
    },
  );
});
