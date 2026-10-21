import { scenario } from "@opensoftware/testkit";
import { lines, opened, prUrl, readReport, runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-017", async ({ sut, given, when, then }) => {
  await given(
    'the run "run-01" with spend rows of 3.00 USD that lists the pull requests "https://github.com/acme/web/pull/1" and "https://github.com/acme/web/pull/2"',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          opened(1),
          opened(2),
          runLine("run-01", { pullRequests: [prUrl(1), prUrl(2)] }),
          spendRow("req-1", 3, { run: "run-01" }),
        ),
      );
    },
  );

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" lists both pull requests with the cost 1.50 USD', async () => {
    expect((await readReport(sut)).topPullRequests).toEqual([
      { url: prUrl(1), title: "Change 1", usd: 1.5 },
      { url: prUrl(2), title: "Change 2", usd: 1.5 },
    ]);
  });
});
