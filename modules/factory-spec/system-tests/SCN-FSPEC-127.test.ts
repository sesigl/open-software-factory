import { scenario } from "@opensoftware/testkit";
import { FAR, putEntries } from "./remote.ts";

scenario("SCN-FSPEC-127", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" has the skill "git+https://forge.example/acme/skills.git#v1:skills/review" and no factory.lock',
    async () => {
      await putEntries(sut, [FAR]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render"', async () => {
    run = await sut.cli(["render"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "factory.lock has no pin of the skill \\"review\\" for \\"git+https://forge.example/acme/skills.git#v1:skills/review\\": run \\"factory plan\\""',
    async () => {
      expect(run.stderr).toContain(`factory.lock has no pin of the skill "review" for "${FAR}": run "factory plan"`);
    },
  );
});
