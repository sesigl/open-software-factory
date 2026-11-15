import { scenario } from "@opensoftware/testkit";
import { putSkilled } from "./skills.ts";

scenario("SCN-FSPEC-112", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has the skills "./skills/missing" and "./skills/notes.md" on line 14',
    async () => {
      await putSkilled(sut, ["./skills/missing", "./skills/notes.md"]);
    },
  );

  await given('the factory folder has no "skills/missing" and has the file "skills/notes.md"', async () => {
    await sut.files.put("$INPUT/skills/notes.md", "# Notes\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "factory.yaml:14:14 the skill \\"./skills/missing\\" has no SKILL.md", "factory.yaml:14:32 the skill \\"./skills/notes.md\\" has no SKILL.md" and then "factory.yaml: 2 problems"',
    async () => {
      expect(run.stdout).toBe(
        [
          'factory.yaml:14:14 the skill "./skills/missing" has no SKILL.md',
          'factory.yaml:14:32 the skill "./skills/notes.md" has no SKILL.md',
          "factory.yaml: 2 problems",
          "",
        ].join("\n"),
      );
    },
  );
});
