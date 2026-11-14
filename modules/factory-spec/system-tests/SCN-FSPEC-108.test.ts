import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled, skillMd } from "./skills.ts";

/** A SKILL.md of the number of lines: its front matter and blank line take 5, its body the rest. */
const ofLines = (name: string, count: number): string =>
  skillMd([`name: ${name}`, `description: The skill ${name}. Use it in a scenario.`], "Do this.\n".repeat(count - 5));

scenario("SCN-FSPEC-108", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has the skills "./skills/short" with a SKILL.md of 499 lines and "./skills/long" with one of 500',
    async () => {
      await putSkilled(sut, ["./skills/short", "./skills/long"]);
      await putSkill(sut, "skills/short", ofLines("short", 499));
      await putSkill(sut, "skills/long", ofLines("long", 500));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output is "skills/long/SKILL.md:1:1 warning: SKILL.md has 500 lines; the format asks for fewer than 500, with the details in files beside it" and then "factory.yaml: no problems, 1 warning"',
    async () => {
      expect(run.stdout).toBe(
        "skills/long/SKILL.md:1:1 warning: SKILL.md has 500 lines; the format asks for fewer than 500, with the details in files beside it\n" +
          "factory.yaml: no problems, 1 warning\n",
      );
    },
  );
});
