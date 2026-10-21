import { scenario } from "@opensoftware/testkit";
import { busyWeek, readReport } from "./records.ts";

scenario("SCN-LEDGER-019", async ({ sut, given, when, then }) => {
  await given("326 pull requests opened in the period and spend rows of 5351.38 USD in total", async () => {
    await sut.files.put("$INPUT/data.jsonl", busyWeek());
  });

  await when('the user runs "ledger report --target 15 data.jsonl"', async () => {
    expect((await sut.cli(["report", "--target", "15", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" shows the target 15.00 USD and the gap 1.42 USD', async () => {
    expect((await readReport(sut)).costPerPullRequest).toMatchObject({ target: 15, gap: 1.42 });
  });
});
