import { scenario } from "@opensoftware/testkit";
import { lines, opened, prUrl, readReport, runLine, spendRow } from "./records.ts";

const other = "https://github.com/other/app/pull/9";

scenario("SCN-LEDGER-056", async ({ sut, given, when, then }) => {
  await given(
    'the run "run-01" with spend rows of 3.00 USD that lists the pull requests "https://github.com/acme/web/pull/1" and "https://github.com/other/app/pull/9"',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(runLine("run-01", { pullRequests: [prUrl(1), other] }), spendRow("req-1", 3, { run: "run-01" })),
      );
    },
  );

  await given(
    'a "pr.opened@v1" event for "https://github.com/acme/web/pull/1" and none for "https://github.com/other/app/pull/9"',
    async () => {
      await sut.files.put("$INPUT/data.jsonl", (await sut.files.read("$INPUT/data.jsonl")) + lines(opened(1)));
    },
  );

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" lists "https://github.com/acme/web/pull/1" with the cost 3.00 USD', async () => {
    expect((await readReport(sut)).topPullRequests).toEqual([{ url: prUrl(1), title: "Change 1", usd: 3 }]);
  });
});
