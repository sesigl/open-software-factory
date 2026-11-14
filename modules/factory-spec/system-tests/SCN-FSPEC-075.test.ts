import { scenario } from "@opensoftware/testkit";
import { putTriage, resolved } from "./edit.ts";

scenario("SCN-FSPEC-075", async ({ sut, given, when, then }) => {
  let yaml = "";
  await given('a factory.yaml whose agent "triage" has no skills', async () => {
    yaml = await putTriage(sut, []);
  });

  await given('the skill folder "skills/review"', async () => {
    await sut.files.put("$INPUT/skills/review/SKILL.md", "---\nname: review\ndescription: Review a change.\n---\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-skill triage ./skills/review"', async () => {
    run = await sut.cli(["edit", "add-skill", "triage", "./skills/review"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"factory resolve" of the output gives "triage" the skills "./skills/review"', async () => {
    const { agents } = await resolved(sut, run);
    expect(agents.triage?.skills).toEqual(["./skills/review"]);
  });

  await then("factory.yaml in the factory folder is unchanged", async () => {
    expect(await sut.files.read("$INPUT/factory.yaml")).toBe(yaml);
  });
});
