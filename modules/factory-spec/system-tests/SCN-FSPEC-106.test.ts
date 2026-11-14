import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled, skillMd } from "./skills.ts";

const AT = "a".repeat(64);
const OVER = "b".repeat(65);

/** A SKILL.md whose description and compatibility have the lengths; a character outside the BMP counts as one. */
const sized = (name: string, description: number, compatibility: number): string =>
  skillMd([
    `name: ${name}`,
    `description: ${"d".repeat(description - 1)}🙂`,
    `compatibility: ${"c".repeat(compatibility)}`,
  ]);

scenario("SCN-FSPEC-106", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has a skill with a name of 64 characters, a description of 1024 and a compatibility of 500',
    async () => {
      await putSkilled(sut, [`./skills/${AT}`, `./skills/${OVER}`]);
      await putSkill(sut, `skills/${AT}`, sized(AT, 1024, 500));
    },
  );

  await given("a skill with a name of 65 characters, a description of 1025 and a compatibility of 501", async () => {
    await putSkill(sut, `skills/${OVER}`, sized(OVER, 1025, 501));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "name has 65 characters, more than the 64 the format allows", "description has 1025 characters, more than the 1024 the format allows" and "compatibility has 501 characters, more than the 500 the format allows" in the second SKILL.md, and then "factory.yaml: 3 problems"',
    async () => {
      const file = `skills/${OVER}/SKILL.md`;
      expect(run.stdout).toBe(
        [
          `${file}:2:1 name has 65 characters, more than the 64 the format allows`,
          `${file}:3:1 description has 1025 characters, more than the 1024 the format allows`,
          `${file}:4:1 compatibility has 501 characters, more than the 500 the format allows`,
          "factory.yaml: 3 problems",
          "",
        ].join("\n"),
      );
    },
  );
});
