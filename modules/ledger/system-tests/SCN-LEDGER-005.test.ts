import { scenario } from "@opensoftware/testkit";
import { runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-005", async ({ sut, given, when, then }) => {
  await given(
    'the folder "exports" with the file "exports/runs/run-01.jsonl" holding 1 run and the file "exports/spend.json" holding 2 spend rows',
    async () => {
      await sut.files.put("$INPUT/exports/runs/run-01.jsonl", `${runLine("run-01")}\n`);
      await sut.files.put("$INPUT/exports/spend.json", JSON.stringify([spendRow("req-1", 1), spendRow("req-2", 2)]));
      await sut.files.put("$INPUT/exports/notes.txt", "not read\n");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger ingest exports"', async () => {
    run = await sut.cli(["ingest", "exports"]);
  });

  await then('the output says "ingested 1 run, 2 spend rows and 0 events into ledger.duckdb"', async () => {
    expect(run.stdout, run.stderr).toContain("ingested 1 run, 2 spend rows and 0 events into ledger.duckdb");
  });
});
