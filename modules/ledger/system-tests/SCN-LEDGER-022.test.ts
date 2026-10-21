import { scenario } from "@opensoftware/testkit";
import { lines, opened, prUrl, readReport, runLine } from "./records.ts";

scenario("SCN-LEDGER-022", async ({ sut, given, when, then }) => {
  await given(
    'a pull request opened at 10:00 whose runs started at 09:30 and at 07:00, without a "work.received@v1" event',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          opened(1, { at: "2026-01-05T10:00:00Z" }),
          runLine("run-01", { start: "2026-01-05T09:30:00Z", pullRequests: [prUrl(1)] }),
          runLine("run-02", { start: "2026-01-05T07:00:00Z", pullRequests: [prUrl(1)] }),
        ),
      );
    },
  );

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then('"report.json" shows the median hours from kickoff to pull request 3', async () => {
    expect((await readReport(sut)).cycleTime.kickoffToPullRequest).toBe(3);
  });
});
