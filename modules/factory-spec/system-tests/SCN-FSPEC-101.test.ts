import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled } from "./skills.ts";

scenario("SCN-FSPEC-101", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the skill "./skills/release-notes" on line 14', async () => {
    await putSkilled(sut, ["./skills/release-notes"]);
  });

  await given('the folder "skills/release-notes" holds only "README.md"', async () => {
    await putSkill(sut, "skills/release-notes", "# Release notes\n", "README.md");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "factory.yaml:14:14 the skill \\"./skills/release-notes\\" has no SKILL.md" and then "factory.yaml: 1 problems"',
    async () => {
      expect(run.stdout).toBe(
        'factory.yaml:14:14 the skill "./skills/release-notes" has no SKILL.md\nfactory.yaml: 1 problems\n',
      );
    },
  );
});
