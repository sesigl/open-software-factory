import { scenario } from "@opensoftware/testkit";
import { lines, opened, readReport, spendRow } from "./records.ts";

scenario("SCN-LEDGER-004", async ({ sut, given, when, then }) => {
  await given(
    'the file "data.jsonl" with the pull request "https://github.com/acme/web/pull/1" and spend rows of 2.50 USD in total',
    async () => {
      await sut.files.put("$INPUT/data.jsonl", lines(opened(1), spendRow("req-1", 2), spendRow("req-2", 0.5)));
    },
  );

  await when('the user runs "ledger ingest data.jsonl" twice and then "ledger report"', async () => {
    for (const _ of [1, 2]) expect((await sut.cli(["ingest", "data.jsonl"])).exitCode).toBe(0);
    expect((await sut.cli(["report"])).exitCode).toBe(0);
  });

  await then('"report.json" shows 1 pull request and a total spend of 2.50 USD', async () => {
    const report = await readReport(sut);
    expect(report.pullRequests.opened).toBe(1);
    expect(report.spend.total).toBe(2.5);
  });
});
