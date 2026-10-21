import { scenario } from "@opensoftware/testkit";
import { closed, lines, opened, prUrl, received, reviewed, runLine, spanIdOf, spendRow } from "./records.ts";

scenario("SCN-LEDGER-031", async ({ sut, fakes, given, when, then }) => {
  await given('runs, spend rows, work items, reviews, merges and a revert in "data.jsonl"', async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(
        received("work-1", "2026-01-05T08:00:00Z"),
        runLine("run-1", {
          workItem: "work-1",
          start: "2026-01-05T09:00:00Z",
          hours: 2,
          source: "slack",
          agent: "implementer",
        }),
        runLine("run-2", {
          start: "2026-01-06T09:00:00Z",
          hours: 1,
          cost: 0.8,
          source: "github",
          requester: "github:hubot",
          agent: "reviewer",
          pullRequests: [prUrl(2), prUrl(3)],
        }),
        runLine("run-3", {
          start: "2026-01-06T09:15:00Z",
          hours: 0.5,
          cost: 0.2,
          agent: "tester",
          parent: { run: "run-2", span: spanIdOf("run-2") },
        }),
        spendRow("req-1", 3.1, { run: "run-1", at: "2026-01-05T09:30:00Z" }),
        spendRow("req-2", 1.25, { run: "run-1", at: "2026-01-05T10:30:00Z", model: "claude-haiku-5-5" }),
        spendRow("req-3", 0.5, { at: "2026-01-06T12:00:00Z" }),
        opened(1, { at: "2026-01-05T11:00:00Z", workItem: "work-1" }),
        reviewed(1, "2026-01-05T12:00:00Z", { bot: true }),
        reviewed(1, "2026-01-05T13:00:00Z", { state: "changes_requested" }),
        reviewed(1, "2026-01-05T14:00:00Z"),
        closed(1, "2026-01-05T15:00:00Z"),
        opened(2, { at: "2026-01-06T10:00:00Z" }),
        opened(3, { at: "2026-01-06T10:30:00Z", title: 'Revert "Change 1"' }),
        closed(3, "2026-01-06T12:00:00Z"),
        closed(2, "2026-01-07T09:00:00Z", false),
      ),
    );
  });

  const options = ["--target", "1", "--compute-usd-per-hour", "0.50", "--platform-usd", "3", "--markdown", "report.md"];
  await given('"duckdb.json" written by "ledger report --out duckdb.json data.jsonl"', async () => {
    const run = await sut.cli(["report", ...options, "--out", "duckdb.json", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger report --db <database URL> --out postgres.json data.jsonl"', async () => {
    const db = await fakes.postgres();
    run = await sut.cli(["report", ...options, "--db", db.url, "--out", "postgres.json", "data.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"postgres.json" equals "duckdb.json"', async () => {
    const duckdb = JSON.parse(await sut.files.read("$INPUT/duckdb.json"));
    // The sample reaches every part of the report, so an empty part cannot hide a difference.
    expect(duckdb.revertRate.reverts).toBe(1);
    expect(duckdb.cycleTime.firstHumanReviewToMerge).not.toBeNull();
    expect(duckdb.runs.topLevel).toBeLessThan(duckdb.runs.total);
    expect(duckdb.spend.unattributed).toBeGreaterThan(0);
    expect(JSON.parse(await sut.files.read("$INPUT/postgres.json"))).toEqual(duckdb);
  });
});
