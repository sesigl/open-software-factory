import { scenario } from "@opensoftware/testkit";
import { lines, readReport, runLine } from "./records.ts";

scenario("SCN-LEDGER-014", async ({ sut, given, when, then }) => {
  await given('the run "run-01" with the cost 1.25 USD and no spend rows', async () => {
    await sut.files.put("$INPUT/data.jsonl", lines(runLine("run-01", { cost: 1.25 })));
  });

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" shows a total spend of 1.25 USD', async () => {
    expect((await readReport(sut)).spend.total).toBe(1.25);
  });
});
