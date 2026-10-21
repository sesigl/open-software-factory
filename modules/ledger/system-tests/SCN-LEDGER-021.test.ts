import { scenario } from "@opensoftware/testkit";
import { closed, lines, opened, readReport, received, reviewed } from "./records.ts";

const pullRequest = (number: number, times: { opened: string; reviewed: string; merged: string }) =>
  lines(
    received(`work-0${number}`, "2026-01-05T08:00:00Z"),
    opened(number, { at: `2026-01-05T${times.opened}:00Z`, workItem: `work-0${number}` }),
    reviewed(number, `2026-01-05T${times.reviewed}:00Z`),
    closed(number, `2026-01-05T${times.merged}:00Z`),
  );

scenario("SCN-LEDGER-021", async ({ sut, given, when, then }) => {
  await given(
    "a pull request whose work item was received at 08:00, opened at 09:00, first reviewed by a person at 11:00 and merged at 12:00",
    async () => {
      await sut.files.put("$INPUT/data.jsonl", pullRequest(1, { opened: "09:00", reviewed: "11:00", merged: "12:00" }));
    },
  );

  await given(
    "a pull request whose work item was received at 08:00, opened at 10:00, first reviewed by a person at 14:00 and merged at 16:00",
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        (await sut.files.read("$INPUT/data.jsonl")) +
          pullRequest(2, { opened: "10:00", reviewed: "14:00", merged: "16:00" }),
      );
    },
  );

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then(
    '"report.json" shows the median hours from kickoff to pull request 1.5, from kickoff to merge 6, from pull request to first human review 3 and from first human review to merge 1.5',
    async () => {
      expect((await readReport(sut)).cycleTime).toEqual({
        kickoffToPullRequest: 1.5,
        kickoffToMerge: 6,
        pullRequestToFirstHumanReview: 3,
        firstHumanReviewToMerge: 1.5,
      });
    },
  );
});
