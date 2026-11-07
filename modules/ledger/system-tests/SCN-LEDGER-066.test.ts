import { scenario } from "@opensoftware/testkit";
import { lines, readMarkdown, spendRow, table } from "./records.ts";

scenario("SCN-LEDGER-066", async ({ sut, given, when, then }) => {
  await given("spend rows of 2.00 USD and no pull request events", async () => {
    await sut.files.put("$INPUT/data.jsonl", lines(spendRow("req-1", 1.5), spendRow("req-2", 0.5)));
  });

  await when('the user runs "ledger report --markdown report.md data.jsonl"', async () => {
    const run = await sut.cli(["report", "--markdown", "report.md", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"report.md" has the title "# Ledger report: start to end"', async () => {
    expect((await readMarkdown(sut)).split("\n")[1]).toBe("# Ledger report: start to end");
  });

  await then(
    '"report.md" has the table "Measure | Value" with the rows "Pull requests opened | 0", "Pull requests merged | 0", "Human interactions per pull request | -", "Runs | 0" and "Top-level runs | 0"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        table(
          "Measure | Value",
          "Pull requests opened | 0",
          "Pull requests merged | 0",
          "Human interactions per pull request | -",
          "Runs | 0",
          "Top-level runs | 0",
        ),
      );
    },
  );

  await then(
    '"report.md" has the table "Segment | Median" with the rows "Kickoff to pull request | -", "Kickoff to merge | -", "Pull request to first human review | -" and "First human review to merge | -"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        table(
          "Segment | Median",
          "Kickoff to pull request | -",
          "Kickoff to merge | -",
          "Pull request to first human review | -",
          "First human review to merge | -",
        ),
      );
    },
  );

  await then(
    '"report.md" has the table "Measure | Value" with the rows "Cost per pull request | -", "Inference per pull request | -", "Compute per pull request | -", "Platform per pull request | -", "Target | -" and "Gap to target | -"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        table(
          "Measure | Value",
          "Cost per pull request | -",
          "Inference per pull request | -",
          "Compute per pull request | -",
          "Platform per pull request | -",
          "Target | -",
          "Gap to target | -",
        ),
      );
    },
  );

  await then('"report.md" has the table "Reverts | Merged | Rate" with the row "0 | 0 | -"', async () => {
    expect(await readMarkdown(sut)).toContain(table("Reverts | Merged | Rate", "0 | 0 | -"));
  });
});
