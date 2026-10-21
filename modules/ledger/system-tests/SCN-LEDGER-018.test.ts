import { scenario } from "@opensoftware/testkit";
import { lines, opened, prUrl, readReport, runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-018", async ({ sut, given, when, then }) => {
  await given(
    'the run "run-01" of the work item "work-01" with spend rows of 4.00 USD and no pull request',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(runLine("run-01", { workItem: "work-01" }), spendRow("req-1", 4, { run: "run-01" })),
      );
    },
  );

  await given(
    'a "pr.opened@v1" event for "https://github.com/acme/web/pull/7" of the work item "work-01"',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        (await sut.files.read("$INPUT/data.jsonl")) + lines(opened(7, { workItem: "work-01" })),
      );
    },
  );

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" lists "https://github.com/acme/web/pull/7" with the cost 4.00 USD', async () => {
    expect((await readReport(sut)).topPullRequests).toEqual([{ url: prUrl(7), title: "Change 7", usd: 4 }]);
  });
});
