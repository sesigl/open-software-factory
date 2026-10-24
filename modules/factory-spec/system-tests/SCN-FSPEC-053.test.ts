import { scenario } from "@opensoftware/testkit";
import { INTAKE, putForgeFactory, SECRET } from "./forge.ts";

scenario("SCN-FSPEC-053", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" operates on "tester/web" and the automation "github.issue.labeled(auto-implement)"',
    async () => {
      await putForgeFactory(sut, "tester", true, "github");
    },
  );

  await given("FACTORY_GITHUB_TOKEN is not set", async () => {});

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"], { env: { FACTORY_INTAKE_URL: INTAKE, FACTORY_WEBHOOK_SECRET: SECRET } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "set FACTORY_GITHUB_TOKEN to manage the webhooks of github automations"',
    async () => {
      expect(run.stderr).toContain("set FACTORY_GITHUB_TOKEN to manage the webhooks of github automations");
    },
  );
});
