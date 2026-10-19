import { scenario } from "@osf/testkit";

scenario("SCN-CTR-007", async ({ sut, fakes, given, when, then }) => {
  const fixtures: string[] = [];

  await given("the valid fixtures of every format", async () => {
    for (const [path, content] of Object.entries(fakes.fromRepository("contracts"))) {
      if (!path.includes("/fixtures/valid/") || path.startsWith("system-tests/")) continue;
      await sut.files.put(`contracts/${path}`, content);
      fixtures.push(`contracts/${path}`);
    }
    expect(fixtures.length).toBeGreaterThanOrEqual(11);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf-contracts roundtrip --client python"', async () => {
    run = await sut.cli(["roundtrip", "--client", "python"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output names every valid fixture as "unchanged"', async () => {
    for (const fixture of fixtures) expect(run.stdout).toContain(`${fixture}: unchanged`);
  });
});
