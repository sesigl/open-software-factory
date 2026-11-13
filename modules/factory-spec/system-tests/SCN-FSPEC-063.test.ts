import { scenario } from "@opensoftware/testkit";
import { putCronFactory } from "./lint-cron.ts";

scenario("SCN-FSPEC-063", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose automation on line 13 has the cron "0 10 * * *" that runs "self-triage-report"',
    async () => {
      await putCronFactory(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint"', async () => {
    run = await sut.cli(["lint"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output is "factory.yaml:13:5 warning /automations/0/cron: only a gh-aw workflow runs a cron automation, so render it with --gh-aw" and then "factory.yaml: no problems, 1 warning"',
    async () => {
      expect(run.stdout).toBe(
        "factory.yaml:13:5 warning /automations/0/cron: only a gh-aw workflow runs a cron automation, so render it with --gh-aw\n" +
          "factory.yaml: no problems, 1 warning\n",
      );
    },
  );
});
