import { scenario } from "@opensoftware/testkit";
import { type Panel, panelSql, panels } from "./postgres.ts";
import { lines, opened, runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-037", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given(
    "2 pull requests, spend rows of 10.00 USD in total and runs of 4 hours in total, ingested into a PostgreSQL database",
    async () => {
      url = (await fakes.postgres()).url;
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          opened(1),
          opened(2),
          runLine("run-01", { hours: 1.5 }),
          runLine("run-02", { hours: 2.5 }),
          spendRow("req-1", 6, { run: "run-01" }),
          spendRow("req-2", 4, { run: "run-02" }),
        ),
      );
      const run = await sut.cli(["ingest", "--db", url, "data.jsonl"]);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

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
    'the user runs the SQL of the panel "Cost per pull request" with "ledger query --db <database URL>", "compute_usd_per_hour" 0.50 and "platform_usd" 6',
    async () => {
      if (!panel) throw new Error('the dashboard has no panel "Cost per pull request"');
      const sql = panelSql(
        panel,
        { from: "2026-01-05", to: "2026-01-06" },
        { compute_usd_per_hour: "0.50", platform_usd: "6" },
      );
      run = await sut.cli(["query", "--db", url, sql]);
    },
  );

  await then('the output is {"Cost per pull request":9}', async () => {
    expect(run.stdout, run.stderr).toBe('{"Cost per pull request":9}\n');
  });
});
