import { scenario } from "@opensoftware/testkit";
import { FAR, putEntries } from "./remote.ts";

scenario("SCN-FSPEC-125", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has the skill "git+https://forge.example/acme/skills.git#v1:skills/review" and no factory.lock',
    async () => {
      await putEntries(sut, [FAR]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory plan --check"', async () => {
    run = await sut.cli(["plan", "--check"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is "factory.lock has no pin of the skill \\"review\\" for \\"git+https://forge.example/acme/skills.git#v1:skills/review\\": run \\"factory plan\\""',
    async () => {
      expect(run.stdout).toBe(`factory.lock has no pin of the skill "review" for "${FAR}": run "factory plan"\n`);
    },
  );

  await then("the folder of factory.yaml has no factory.lock", async () => {
    expect(await sut.files.list("$INPUT")).not.toContain("factory.lock");
  });
});
