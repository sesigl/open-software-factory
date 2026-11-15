import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled, skillMd } from "./skills.ts";

scenario("SCN-FSPEC-099", async ({ sut, given, when, then }) => {
  await given('a factory.yaml whose agent "triage" has the skill "./skills/release-notes"', async () => {
    await putSkilled(sut, ["./skills/release-notes"]);
  });

  await given(
    'its SKILL.md has a name, a description, a license, a compatibility, "allowed-tools: Bash(git:*) Read", "disable-model-invocation: true" and the metadata "short-description: Release notes" and "opencode/autoinvoke: false"',
    async () => {
      const front = [
        "name: release-notes",
        "description: Write the release notes of a change. Use when a change ships.",
        "license: Apache-2.0",
        "compatibility: Needs git",
        "allowed-tools: Bash(git:*) Read",
        "disable-model-invocation: true",
        "metadata:",
        "  short-description: Release notes",
        "  opencode/autoinvoke: false",
      ];
      await putSkill(sut, "skills/release-notes", skillMd(front));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "factory.yaml: no problems"', async () => {
    expect(run.stdout).toBe("factory.yaml: no problems\n");
  });
});
