import { scenario } from "@opensoftware/testkit";
import { putTriage } from "./edit.ts";

scenario("SCN-FSPEC-082", async ({ sut, given, when, then }) => {
  let yaml = "";
  await given(
    'a factory.yaml whose agent "triage" has the skills "./skills/review" and "./skills/testing" written as "[ ./skills/review, ./skills/testing ]"',
    async () => {
      yaml = await putTriage(sut, ["skills: [ ./skills/review, ./skills/testing ]"]);
      for (const name of ["review", "testing"])
        await sut.files.put(`$INPUT/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${name}.\n---\n`);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-skill triage ./skills/review"', async () => {
    run = await sut.cli(["edit", "add-skill", "triage", "./skills/review"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the output is factory.yaml, byte for byte", async () => {
    expect(run.stdout).toBe(yaml);
  });
});
