import { scenario } from "@opensoftware/testkit";

const ALLOWED = 'factory.yaml /agents/triage/effort: must be one of "low", "medium", "high", "xhigh", "max"';

scenario("SCN-CTR-012", async ({ sut, fakes, given, when, then }) => {
  await given('a factory definition "factory.yaml" whose agent "triage" has the effort "huge"', async () => {
    const definition = fakes.fixture("factory.yaml").replace("    effort: high\n", "    effort: huge\n");
    await sut.files.put("$INPUT/factory.yaml", definition);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts validate factory-definition factory.yaml"', async () => {
    run = await sut.cli(["validate", "factory-definition", "factory.yaml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "factory.yaml /agents/triage/effort: must be one of \\"low\\", \\"medium\\", \\"high\\", \\"xhigh\\", \\"max\\""',
    async () => {
      expect(run.stdout).toContain(ALLOWED);
    },
  );
});
