import { scenario } from "@opensoftware/testkit";
import { lines, readReport, spendRow } from "./records.ts";

scenario("SCN-LEDGER-029", async ({ sut, given, when, then }) => {
  await given("spend rows of 2.00 USD and no pull request events", async () => {
    await sut.files.put("$INPUT/data.jsonl", lines(spendRow("req-1", 1.5), spendRow("req-2", 0.5)));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger report data.jsonl"', async () => {
    run = await sut.cli(["report", "data.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"report.json" shows a total spend of 2.00 USD and the cost per pull request null', async () => {
    const report = await readReport(sut);
    expect(report.spend.total).toBe(2);
    expect(report.costPerPullRequest).toBeNull();
  });
});
