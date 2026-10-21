import { scenario } from "@opensoftware/testkit";
import { type Panel, panelSql, panels, readmeSample } from "./postgres.ts";

scenario("SCN-LEDGER-035", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given("the sample file from the README ingested into a PostgreSQL database", async () => {
    url = (await fakes.postgres()).url;
    await sut.files.put("$INPUT/ledger.jsonl", readmeSample(fakes));
    const run = await sut.cli(["ingest", "--db", url, "ledger.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  let list: Panel[] = [];
  await given('"ledger-dashboard.json" written by "ledger dashboard"', async () => {
    const run = await sut.cli(["dashboard"]);
    expect(run.exitCode, run.stderr).toBe(0);
    list = panels(await sut.files.read("$OUTPUT/ledger-dashboard.json"));
    expect(list.length).toBeGreaterThan(10);
  });

  const runs: { title: string; run: Awaited<ReturnType<typeof sut.cli>> }[] = [];
  await when(
    'the user runs the SQL of each panel with "ledger query --db <database URL>" for the time range from 2026-01-01 to 2026-01-02',
    async () => {
      for (const panel of list)
        runs.push({
          title: panel.title,
          run: await sut.cli(["query", "--db", url, panelSql(panel, { from: "2026-01-01", to: "2026-01-02" })]),
        });
    },
  );

  await then("every command exits with code 0", async () => {
    expect(runs.filter(({ run }) => run.exitCode !== 0).map(({ title, run }) => `${title}: ${run.stderr}`)).toEqual([]);
  });

  await then("every command prints at least one row", async () => {
    expect(runs.filter(({ run }) => !run.stdout.trim()).map(({ title }) => title)).toEqual([]);
  });
});
