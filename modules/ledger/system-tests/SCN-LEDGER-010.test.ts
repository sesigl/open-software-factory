import { scenario } from "@opensoftware/testkit";
import { busyWeek, readReport } from "./records.ts";

scenario("SCN-LEDGER-010", async ({ sut, given, when, then }) => {
  await given("326 pull requests opened in the period and spend rows of 5351.38 USD in total", async () => {
    await sut.files.put("$INPUT/data.jsonl", busyWeek());
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger report data.jsonl"', async () => {
    run = await sut.cli(["report", "data.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"report.json" shows a cost per pull request of 16.42 USD', async () => {
    expect((await readReport(sut)).costPerPullRequest.usd).toBe(16.42);
  });

  await then('the output says "326 pull requests, cost per pull request 16.42 USD"', async () => {
    expect(run.stdout).toContain("326 pull requests, cost per pull request 16.42 USD");
  });
});
