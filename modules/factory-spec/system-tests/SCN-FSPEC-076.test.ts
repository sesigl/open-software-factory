import { scenario } from "@opensoftware/testkit";
import { putTriage, resolved } from "./edit.ts";

scenario("SCN-FSPEC-076", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has the skills "./skills/review" and "./skills/testing"',
    async () => {
      await putTriage(sut, ["skills:", "  - ./skills/review", "  - ./skills/testing"]);
      for (const name of ["review", "testing"])
        await sut.files.put(`$INPUT/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${name}.\n---\n`);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit remove-skill triage ./skills/review"', async () => {
    run = await sut.cli(["edit", "remove-skill", "triage", "./skills/review"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"factory resolve" of the output gives "triage" the skills "./skills/testing"', async () => {
    const { agents } = await resolved(sut, run);
    expect(agents.triage?.skills).toEqual(["./skills/testing"]);
  });
});
