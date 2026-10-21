import { scenario } from "@opensoftware/testkit";
import { readmeSample } from "./postgres.ts";
import { readReport } from "./records.ts";

scenario("SCN-LEDGER-032", async ({ sut, fakes, given, when, then }) => {
  let url = "";
  await given("the sample file from the README ingested once into a PostgreSQL database", async () => {
    url = (await fakes.postgres()).url;
    await sut.files.put("$INPUT/ledger.jsonl", readmeSample(fakes));
    const run = await sut.cli(["ingest", "--db", url, "ledger.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger report --db <database URL> ledger.jsonl"', async () => {
    run = await sut.cli(["report", "--db", url, "ledger.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.json" shows 2 pull requests and a cost per pull request of 1.75 USD', async () => {
    const report = await readReport(sut);
    expect(report.pullRequests.opened).toBe(2);
    expect(report.costPerPullRequest.usd).toBe(1.75);
  });
});
