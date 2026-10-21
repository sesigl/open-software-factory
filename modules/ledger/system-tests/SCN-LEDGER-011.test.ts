import { scenario } from "@opensoftware/testkit";
import { lines, opened, readReport, runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-011", async ({ sut, given, when, then }) => {
  await given("2 pull requests, spend rows of 10.00 USD in total and runs of 4 hours in total", async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(
        opened(1),
        opened(2),
        runLine("run-01", { hours: 1.5 }),
        runLine("run-02", { hours: 2.5 }),
        spendRow("req-1", 6, { run: "run-01" }),
        spendRow("req-2", 4, { run: "run-02" }),
      ),
    );
  });

  await when('the user runs "ledger report --compute-usd-per-hour 0.50 --platform-usd 6 data.jsonl"', async () => {
    const run = await sut.cli(["report", "--compute-usd-per-hour", "0.50", "--platform-usd", "6", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"report.json" shows a cost per pull request of 9.00 USD split into inference 5.00, compute 1.00 and platform 3.00',
    async () => {
      expect((await readReport(sut)).costPerPullRequest).toMatchObject({
        usd: 9,
        inference: 5,
        compute: 1,
        platform: 3,
      });
    },
  );
});
