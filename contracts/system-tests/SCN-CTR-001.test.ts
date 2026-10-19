import { scenario } from "@opensoftware/testkit";

scenario("SCN-CTR-001", async ({ sut, fakes, given, when, then }) => {
  await given('a factory definition "factory.yaml" with the agents "triage" and "implement"', async () => {
    await sut.files.put("$INPUT/factory.yaml", fakes.fixture("factory.yaml"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate factory-definition factory.yaml"', async () => {
    run = await sut.cli(["validate", "factory-definition", "factory.yaml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "factory.yaml: valid factory-definition"', async () => {
    expect(run.stdout).toContain("factory.yaml: valid factory-definition");
  });
});
