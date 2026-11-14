import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled } from "./skills.ts";

const NO_FRONT_MATTER =
  'SKILL.md has no front matter: it starts with a line "---", the fields name and description and a line "---"';

scenario("SCN-FSPEC-113", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the skills "./skills/open" and "./skills/late"', async () => {
    await putSkilled(sut, ["./skills/open", "./skills/late"]);
  });

  await given('the SKILL.md of "open" starts with a line "---" and has no second one', async () => {
    await putSkill(sut, "skills/open", "---\nname: open\ndescription: Open a change.\n\n# Open\n");
  });

  await given('the SKILL.md of "late" starts with "# Late" and has its front matter below it', async () => {
    await putSkill(sut, "skills/late", "# Late\n---\nname: late\ndescription: Do it late.\n---\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output names "skills/open/SKILL.md:1:1" and "skills/late/SKILL.md:1:1", each with "SKILL.md has no front matter: it starts with a line \\"---\\", the fields name and description and a line \\"---\\"", and then "factory.yaml: 2 problems"',
    async () => {
      expect(run.stdout).toBe(
        [
          `skills/open/SKILL.md:1:1 ${NO_FRONT_MATTER}`,
          `skills/late/SKILL.md:1:1 ${NO_FRONT_MATTER}`,
          "factory.yaml: 2 problems",
          "",
        ].join("\n"),
      );
    },
  );
});
