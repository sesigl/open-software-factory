import { scenario } from "@opensoftware/testkit";
import { putSkill, putSkilled, RELEASE_NOTES } from "./skills.ts";

scenario("SCN-FSPEC-097", async ({ sut, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app"',
    async () => {
      await putSkill(sut, "skills/release-notes", RELEASE_NOTES);
    },
  );

  await given(
    'a factory.yaml whose agent "triage" has the skill on line 14, the secret "ref:env/LINEAR_TOKEN" and only the egress host "github.com"',
    async () => {
      const sandbox = ["sandbox:", "  template: node-24", "  egress: [github.com]"];
      await putSkilled(sut, ["./skills/release-notes"], ["secrets: [ref:env/LINEAR_TOKEN]", ...sandbox]);
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
    'the output is "factory.yaml:14:14 agent \\"triage\\" lacks the host \\"api.linear.app\\" that its skill \\"release-notes\\" needs: add it to agents.triage.sandbox.egress" and then "factory.yaml: 1 problems"',
    async () => {
      expect(run.stdout).toBe(
        'factory.yaml:14:14 agent "triage" lacks the host "api.linear.app" that its skill "release-notes" needs: add it to agents.triage.sandbox.egress\n' +
          "factory.yaml: 1 problems\n",
      );
    },
  );
});
