import { scenario } from "@opensoftware/testkit";
import { closed, lines, opened, pageText, received, reviewed } from "./records.ts";

scenario("SCN-LEDGER-063", async ({ sut, given, when, then }) => {
  await given(
    "a pull request whose work item was received at 09:00, opened at 10:00, first reviewed by a person at 12:00 and merged at 13:00",
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          received("work-01", "2026-01-05T09:00:00Z"),
          opened(1, { at: "2026-01-05T10:00:00Z", workItem: "work-01" }),
          reviewed(1, "2026-01-05T12:00:00Z"),
          closed(1, "2026-01-05T13:00:00Z"),
        ),
      );
    },
  );

  await when('the user runs "ledger report --html ledger.html data.jsonl"', async () => {
    const run = await sut.cli(["report", "--html", "ledger.html", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"ledger.html" shows "Kickoff to pull request 1 h", "Kickoff to merge 4 h", "Pull request to first human review 2 h" and "First human review to merge 1 h"',
    async () => {
      const text = await pageText(sut);
      for (const shown of [
        "Kickoff to pull request 1 h",
        "Kickoff to merge 4 h",
        "Pull request to first human review 2 h",
        "First human review to merge 1 h",
      ])
        expect(text).toContain(shown);
    },
  );

  await then('"ledger.html" shows "Human interactions per pull request 1"', async () => {
    expect(await pageText(sut)).toContain("Human interactions per pull request 1");
  });
});
