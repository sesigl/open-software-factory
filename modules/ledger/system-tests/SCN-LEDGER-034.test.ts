import { scenario } from "@opensoftware/testkit";

scenario("SCN-LEDGER-034", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger dashboard"', async () => {
    run = await sut.cli(["dashboard"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output says "wrote" and the path of "ledger-dashboard.json"', async () => {
    expect(run.stdout).toMatch(/^wrote \S*ledger-dashboard\.json$/m);
    expect(await sut.files.list("$OUTPUT")).toContain("ledger-dashboard.json");
  });

  await then(
    '"ledger-dashboard.json" has one data source input of the type "grafana-postgresql-datasource"',
    async () => {
      const dashboard = JSON.parse(await sut.files.read("$OUTPUT/ledger-dashboard.json"));
      expect(dashboard.__inputs).toEqual([
        expect.objectContaining({ name: "DS_LEDGER", type: "datasource", pluginId: "grafana-postgresql-datasource" }),
      ]);
    },
  );
});
