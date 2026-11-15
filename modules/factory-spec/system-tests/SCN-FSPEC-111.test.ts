import { scenario } from "@opensoftware/testkit";
import { putEnvSecret } from "./edit.ts";
import { putSkill, RELEASE_NOTES } from "./skills.ts";

const PROBLEM =
  'the edit would make factory.yaml fail "factory lint": factory.yaml:16:9 agent "triage" lacks the secret LINEAR_TOKEN that its skill "release-notes" needs: add a reference such as "ref:<provider>/linear-token" to agents.triage.secrets';

scenario("SCN-FSPEC-111", async ({ sut, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app"',
    async () => {
      await putSkill(sut, "skills/release-notes", RELEASE_NOTES);
    },
  );

  await given(
    'a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"',
    async () => {
      await putEnvSecret(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory edit add-skill triage ./skills/release-notes"', async () => {
    run = await sut.cli(["edit", "add-skill", "triage", "./skills/release-notes"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the error is the one line "the edit would make factory.yaml fail \\"factory lint\\": factory.yaml:16:9 agent \\"triage\\" lacks the secret LINEAR_TOKEN that its skill \\"release-notes\\" needs: add a reference such as \\"ref:<provider>/linear-token\\" to agents.triage.secrets"',
    async () => {
      expect(run.stderr).toBe(`${PROBLEM}\n`);
    },
  );

  await then("the output is empty", async () => {
    expect(run.stdout).toBe("");
  });
});
