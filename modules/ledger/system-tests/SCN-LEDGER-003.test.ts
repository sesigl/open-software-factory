import { scenario } from "@opensoftware/testkit";
import { closed, lines, opened, reviewed, runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-003", async ({ sut, given, when, then }) => {
  await given('the file "data.jsonl" with 2 runs, 3 spend rows and 4 pull request events', async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(
        runLine("run-01"),
        runLine("run-02"),
        spendRow("req-1", 1, { run: "run-01" }),
        spendRow("req-2", 1, { run: "run-02" }),
        spendRow("req-3", 1),
        opened(1),
        opened(2),
        reviewed(1, "2026-01-05T10:00:00Z"),
        closed(1, "2026-01-05T11:00:00Z"),
      ),
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger ingest data.jsonl"', async () => {
    run = await sut.cli(["ingest", "data.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "ingested 2 runs, 3 spend rows and 4 events into ledger.duckdb"', async () => {
    expect(run.stdout).toContain("ingested 2 runs, 3 spend rows and 4 events into ledger.duckdb");
  });
});
