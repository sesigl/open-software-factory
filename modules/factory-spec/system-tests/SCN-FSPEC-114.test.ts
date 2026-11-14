import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled, skillMd } from "./skills.ts";

/** The text in Latin-1: one byte per character, so "é" is the byte 0xe9, which UTF-8 does not allow alone. */
const latin1 = (text: string): Uint8Array => Uint8Array.from(text, (character) => character.charCodeAt(0));

scenario("SCN-FSPEC-114", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the skill "./skills/release-notes"', async () => {
    await putSkilled(sut, ["./skills/release-notes"]);
  });

  await given(
    'its SKILL.md is valid but written in Latin-1, with the description "Notes for the café team."',
    async () => {
      const text = skillMd(["name: release-notes", "description: Notes for the café team."]);
      await putSkill(sut, "skills/release-notes", latin1(text));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "skills/release-notes/SKILL.md:1:1 the file is not UTF-8 text: the foreman copies a skill\'s files as text, so keep binary files out of the skill" and then "factory.yaml: 1 problems"',
    async () => {
      expect(run.stdout).toBe(
        "skills/release-notes/SKILL.md:1:1 the file is not UTF-8 text: the foreman copies a skill's files as text, so keep binary files out of the skill\n" +
          "factory.yaml: 1 problems\n",
      );
    },
  );
});
