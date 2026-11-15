import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled, RELEASE_NOTES } from "./skills.ts";

scenario("SCN-FSPEC-100", async ({ sut, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app"',
    async () => {
      await putSkill(sut, "skills/release-notes", RELEASE_NOTES);
    },
  );

  await given(
    'a factory.yaml whose agent "triage" has the skill, the secret "ref:env/LINEAR_TOKEN" and no sandbox',
    async () => {
      await putSkilled(sut, ["./skills/release-notes"], ["secrets: [ref:env/LINEAR_TOKEN]"]);
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
