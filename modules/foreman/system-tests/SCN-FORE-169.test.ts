import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, committed } from "./foreman.ts";
import { factoryWithSkill } from "./skills.ts";

const FAR = "git+https://forge.example/acme/skills.git#v1:skills/review";

scenario("SCN-FORE-169", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the README\'s "factory.yaml" whose agent "plan" has the skill "git+https://forge.example/acme/skills.git#v1:skills/review" is committed without a "factory.lock"',
    async () => {
      await committed(sut, fakes, factoryWithSkill(fakes, FAR));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "factory.yaml: factory.lock has no pin of the skill \\"review\\" for \\"git+https://forge.example/acme/skills.git#v1:skills/review\\": run \\"factory plan\\""',
    async () => {
      expect(run.stderr).toContain(
        `factory.yaml: factory.lock has no pin of the skill "review" for "${FAR}": run "factory plan"`,
      );
    },
  );
});
