import { validate } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { type Catalog, putSkill, putSkilled, RELEASE_NOTES } from "./skills.ts";

scenario("SCN-FSPEC-118", async ({ sut, given, when, then }) => {
  await given(
    'the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app"',
    async () => {
      await putSkill(sut, "skills/release-notes", RELEASE_NOTES);
    },
  );

  await given(
    'a factory.yaml whose agent "triage" has the skills "./skills/release-notes" and "./skills/missing", the secret "ref:openbao/linear-token" and only the egress host "github.com"',
    async () => {
      await putSkilled(
        sut,
        ["./skills/release-notes", "./skills/missing"],
        ["secrets: [ref:openbao/linear-token]", "sandbox:", "  template: node-24", "  egress: [github.com]"],
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the console runs "factory skills"', async () => {
    run = await sut.cli(["skills"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output is a valid skill-catalog with the skills "missing" and "release-notes"', async () => {
    const catalog: unknown = JSON.parse(run.stdout);
    expect(validate("skill-catalog", catalog)).toEqual([]);
    expect((catalog as Catalog).skills.map((skill) => [skill.name, skill.body === null])).toEqual([
      ["missing", true],
      ["release-notes", false],
    ]);
  });
});
