import { scenario } from "@opensoftware/testkit";
import { named, putSkill, putSkilled } from "./skills.ts";

/** The signature and the start of the header chunk of a PNG image. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

scenario("SCN-FSPEC-109", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the skill "./skills/release-notes"', async () => {
    await putSkilled(sut, ["./skills/release-notes"]);
    await putSkill(sut, "skills/release-notes", named("release-notes"));
  });

  await given(
    'the skill has the file "assets/logo.png" with the bytes of a PNG image and the file "assets/template.md" with text',
    async () => {
      await putSkill(sut, "skills/release-notes", PNG, "assets/logo.png");
      await putSkill(sut, "skills/release-notes", "# Release notes of {{version}}\n", "assets/template.md");
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
    'the output is "skills/release-notes/assets/logo.png:1:1 the file is not UTF-8 text: the foreman copies a skill\'s files as text, so keep binary files out of the skill" and then "factory.yaml: 1 problems"',
    async () => {
      expect(run.stdout).toBe(
        "skills/release-notes/assets/logo.png:1:1 the file is not UTF-8 text: the foreman copies a skill's files as text, so keep binary files out of the skill\n" +
          "factory.yaml: 1 problems\n",
      );
    },
  );
});
