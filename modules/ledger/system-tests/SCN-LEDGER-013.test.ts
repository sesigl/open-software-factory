import { scenario } from "@opensoftware/testkit";
import { lines, readReport, runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-013", async ({ sut, given, when, then }) => {
  await given('a spend row of 2.00 USD for the run "run-01" and a spend row of 0.50 USD without a run', async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(runLine("run-01", { source: "slack" }), spendRow("req-1", 2, { run: "run-01" }), spendRow("req-2", 0.5)),
    );
  });

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" shows the unattributed spend 0.50 USD', async () => {
    expect((await readReport(sut)).spend.unattributed).toBe(0.5);
  });

  await then('the spend by "source" lists "unattributed" with 0.50 USD and the share 0.2', async () => {
    expect((await readReport(sut)).spend.bySource).toContainEqual({ name: "unattributed", usd: 0.5, share: 0.2 });
  });
});
