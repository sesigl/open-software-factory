import { scenario } from "@opensoftware/testkit";

scenario("SCN-CTR-002", async ({ sut, fakes, given, when, then }) => {
  await given('a factory definition "factory.yaml" whose agent "triage" has the unknown field "modle"', async () => {
    const definition = fakes
      .fixture("factory.yaml")
      .replace("    model: routes/triage\n", "    model: routes/triage\n    modle: x\n");
    await sut.files.put("factory.yaml", definition);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate factory-definition factory.yaml"', async () => {
    run = await sut.cli(["validate", "factory-definition", "factory.yaml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "factory.yaml /agents/triage/modle: unknown field"', async () => {
    expect(run.stdout).toContain("factory.yaml /agents/triage/modle: unknown field");
  });
});
