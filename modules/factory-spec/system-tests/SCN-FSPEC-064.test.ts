import { scenario } from "@opensoftware/testkit";
import { putCronFactory } from "./lint-cron.ts";

scenario("SCN-FSPEC-064", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose automation on line 13 has the cron "0 10 * * *" that runs "self-triage-report"',
    async () => {
      await putCronFactory(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory lint --gh-aw"', async () => {
    run = await sut.cli(["lint", "--gh-aw"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "factory.yaml: no problems"', async () => {
    expect(run.stdout).toBe("factory.yaml: no problems\n");
  });
});
