import { scenario } from "@opensoftware/testkit";
import { committedReview, entryAt, putEntries } from "./remote.ts";
import { skillMd } from "./skills.ts";

scenario("SCN-FSPEC-122", async ({ sut, given, when, then }) => {
  await given(
    'the skill "review" without a description and with the metadata "opensoftware/secrets: LINEAR_TOKEN" is committed in "shared/review" of a Git repository at a "file://" URL',
    async () => {
      await committedReview(sut, skillMd(["name: review", "metadata:", "  opensoftware/secrets: LINEAR_TOKEN"]));
    },
  );

  await given(
    'a factory.yaml whose agent "triage" has the skill "git+<url>#main:shared/review" on line 14 and no secret',
    async () => {
      await putEntries(sut, [entryAt(sut, "main")]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan"', async () => {
    run = await sut.cli(["plan"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output names "factory.yaml:14:14 agent \\"triage\\" lacks the secret LINEAR_TOKEN that its skill \\"review\\" needs" and "git+<url>#main:shared/review/SKILL.md:2:1 the skill has no description"',
    async () => {
      expect(run.stderr.split("\n")).toEqual([
        'factory.yaml:14:14 agent "triage" lacks the secret LINEAR_TOKEN that its skill "review" needs: add a reference such as "ref:<provider>/linear-token" to agents.triage.secrets',
        `${entryAt(sut, "main")}/SKILL.md:2:1 the skill has no description: say what it does and when to use it`,
        "",
      ]);
    },
  );

  await then("the folder of factory.yaml has no factory.lock", async () => {
    expect(await sut.files.list("$INPUT")).not.toContain("factory.lock");
  });
});
