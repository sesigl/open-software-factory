import { scenario } from "@opensoftware/testkit";
import { lines, readReport, runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-015", async ({ sut, given, when, then }) => {
  await given('the run "run-01" with the cost 1.25 USD and spend rows of 2.00 USD for "run-01"', async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(
        runLine("run-01", { cost: 1.25 }),
        spendRow("req-1", 1.5, { run: "run-01" }),
        spendRow("req-2", 0.5, { run: "run-01" }),
      ),
    );
  });

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" shows a total spend of 2.00 USD', async () => {
    expect((await readReport(sut)).spend.total).toBe(2);
  });
});
