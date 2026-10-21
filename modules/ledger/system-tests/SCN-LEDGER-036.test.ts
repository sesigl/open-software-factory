import { scenario } from "@opensoftware/testkit";
import { type Panel, panelSql, panels, readmeSample } from "./postgres.ts";

scenario("SCN-LEDGER-036", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given("the sample file from the README ingested into a PostgreSQL database", async () => {
    url = (await fakes.postgres()).url;
    await sut.files.put("$INPUT/ledger.jsonl", readmeSample(fakes));
    const run = await sut.cli(["ingest", "--db", url, "ledger.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  let panel: Panel | undefined;
  await given('"ledger-dashboard.json" written by "ledger dashboard"', async () => {
    const run = await sut.cli(["dashboard"]);
    expect(run.exitCode, run.stderr).toBe(0);
    panel = panels(await sut.files.read("$OUTPUT/ledger-dashboard.json")).find(
      (each) => each.title === "Cost per pull request",
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs the SQL of the panel "Cost per pull request" with "ledger query --db <database URL>" for the time range from 2026-01-01 to 2026-01-02',
    async () => {
      if (!panel) throw new Error('the dashboard has no panel "Cost per pull request"');
      run = await sut.cli(["query", "--db", url, panelSql(panel, { from: "2026-01-01", to: "2026-01-02" })]);
    },
  );

  await then('the output is {"Cost per pull request":1.75}', async () => {
    expect(run.stdout, run.stderr).toBe('{"Cost per pull request":1.75}\n');
  });
});
