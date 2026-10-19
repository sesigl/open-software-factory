import { scenario } from "@opensoftware/testkit";
import { putForgeFactory } from "./forge.ts";

scenario("SCN-FSPEC-039", async ({ sut, given, when, then }) => {
  await given(
    'a factory.yaml whose agent "triage" operates on "tester/web" and the automation "forgejo.issue.labeled(auto-implement)"',
    async () => {
      await putForgeFactory(sut, "tester");
    },
  );

  await given("FACTORY_FORGE_URL is not set", async () => {});

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory apply"', async () => {
    run = await sut.cli(["apply"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "set FACTORY_FORGE_URL to manage the webhooks of forgejo automations"', async () => {
    expect(run.stderr).toContain("set FACTORY_FORGE_URL to manage the webhooks of forgejo automations");
  });
});
