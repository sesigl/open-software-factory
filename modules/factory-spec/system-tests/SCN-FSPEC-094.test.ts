import { scenario } from "@opensoftware/testkit";
import { putTriage } from "./edit.ts";

const BEFORE = "skills: &skills [./skills/review]";

scenario("SCN-FSPEC-094", async ({ sut, given, when, then }) => {
  let yaml = "";
  await given(
    'a factory.yaml whose agent "triage" has the line "skills: &skills [./skills/review]" and the skill folders "skills/review" and "skills/testing"',
    async () => {
      yaml = await putTriage(sut, [BEFORE]);
      for (const name of ["review", "testing"])
        await sut.files.put(`$INPUT/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${name}.\n---\n`);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-skill triage ./skills/testing"', async () => {
    run = await sut.cli(["edit", "add-skill", "triage", "./skills/testing"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output has the line "skills: &skills [./skills/review, ./skills/testing]" in place of "skills: &skills [./skills/review]"',
    async () => {
      expect(run.stdout).toBe(yaml.replace(BEFORE, "skills: &skills [./skills/review, ./skills/testing]"));
    },
  );
});
