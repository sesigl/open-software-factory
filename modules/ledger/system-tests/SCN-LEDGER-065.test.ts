import { scenario } from "@opensoftware/testkit";
import {
  closed,
  lines,
  opened,
  prUrl,
  readMarkdown,
  received,
  reviewed,
  runLine,
  spendRow,
  table,
  under,
} from "./records.ts";

scenario("SCN-LEDGER-065", async ({ sut, given, when, then }) => {
  await given(
    'a pull request "Add the login" opened on 2026-01-05 at 09:00 for a work item received at 08:00, reviewed by a person at 11:00 and merged on 2026-01-06 at 12:00',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          received("work-01", "2026-01-05T08:00:00Z"),
          opened(1, { at: "2026-01-05T09:00:00Z", title: "Add the login", workItem: "work-01" }),
          reviewed(1, "2026-01-05T11:00:00Z"),
          closed(1, "2026-01-06T12:00:00Z"),
        ),
      );
    },
  );

  await given(
    'a run of 2 hours of the agent "implementer" from the source "slack" for that pull request, with spend rows of 4.00 USD',
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        (await sut.files.read("$INPUT/data.jsonl")) +
          lines(
            runLine("run-01", {
              start: "2026-01-05T08:30:00Z",
              hours: 2,
              workItem: "work-01",
              agent: "implementer",
              source: "slack",
              pullRequests: [prUrl(1)],
            }),
            spendRow("req-1", 3, { run: "run-01" }),
            spendRow("req-2", 1, { run: "run-01" }),
          ),
      );
    },
  );

  await when(
    'the user runs "ledger report --since 2026-01-05 --until 2026-01-06 --target 3 --compute-usd-per-hour 0.50 --platform-usd 1 --markdown report.md data.jsonl"',
    async () => {
      const run = await sut.cli([
        "report",
        "--since",
        "2026-01-05",
        "--until",
        "2026-01-06",
        "--target",
        "3",
        "--compute-usd-per-hour",
        "0.50",
        "--platform-usd",
        "1",
        "--markdown",
        "report.md",
        "data.jsonl",
      ]);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then('"report.md" has the title "# Ledger report: 2026-01-05 to 2026-01-06"', async () => {
    expect((await readMarkdown(sut)).split("\n")[1]).toBe("# Ledger report: 2026-01-05 to 2026-01-06");
  });

  await then(
    '"report.md" has the table "Measure | Value" with the rows "Pull requests opened | 1", "Pull requests merged | 1", "Human interactions per pull request | 1", "Runs | 1" and "Top-level runs | 1"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        table(
          "Measure | Value",
          "Pull requests opened | 1",
          "Pull requests merged | 1",
          "Human interactions per pull request | 1",
          "Runs | 1",
          "Top-level runs | 1",
        ),
      );
    },
  );

  await then(
    '"report.md" has the table "Day | Opened | Merged" with the rows "2026-01-05 | 1 | 0" and "2026-01-06 | 0 | 1"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        table("Day | Opened | Merged", "2026-01-05 | 1 | 0", "2026-01-06 | 0 | 1"),
      );
    },
  );

  await then(
    '"report.md" has the table "Segment | Median" with the rows "Kickoff to pull request | 1 h", "Kickoff to merge | 28 h", "Pull request to first human review | 2 h" and "First human review to merge | 25 h"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        table(
          "Segment | Median",
          "Kickoff to pull request | 1 h",
          "Kickoff to merge | 28 h",
          "Pull request to first human review | 2 h",
          "First human review to merge | 25 h",
        ),
      );
    },
  );

  await then(
    '"report.md" has the table "Measure | Value" with the rows "Cost per pull request | 6.00 USD", "Inference per pull request | 4.00 USD", "Compute per pull request | 1.00 USD", "Platform per pull request | 1.00 USD", "Target | 3.00 USD" and "Gap to target | 3.00 USD"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        table(
          "Measure | Value",
          "Cost per pull request | 6.00 USD",
          "Inference per pull request | 4.00 USD",
          "Compute per pull request | 1.00 USD",
          "Platform per pull request | 1.00 USD",
          "Target | 3.00 USD",
          "Gap to target | 3.00 USD",
        ),
      );
    },
  );

  await then(
    '"report.md" has the table "Pull request | Title | Cost" with the row "https://github.com/acme/web/pull/1 | Add the login | 5.00 USD"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        table("Pull request | Title | Cost", "https://github.com/acme/web/pull/1 | Add the login | 5.00 USD"),
      );
    },
  );

  await then(
    '"report.md" has the table "Measure | Value" with the rows "Total | 4.00 USD" and "Unattributed | 0.00 USD"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        table("Measure | Value", "Total | 4.00 USD", "Unattributed | 0.00 USD"),
      );
    },
  );

  await then(
    '"report.md" has under "### By source" the table "source | Spend | Share" with the row "slack | 4.00 USD | 100.0%"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        under("### By source", table("source | Spend | Share", "slack | 4.00 USD | 100.0%")),
      );
    },
  );

  await then(
    '"report.md" has under "### By user" the table "user | Spend | Share" with the row "github:mona | 4.00 USD | 100.0%"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        under("### By user", table("user | Spend | Share", "github:mona | 4.00 USD | 100.0%")),
      );
    },
  );

  await then(
    '"report.md" has under "### By agent" the table "agent | Spend | Share" with the row "implementer | 4.00 USD | 100.0%"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        under("### By agent", table("agent | Spend | Share", "implementer | 4.00 USD | 100.0%")),
      );
    },
  );

  await then(
    '"report.md" has under "### By model" the table "model | Spend | Share" with the row "claude-sonnet-5-5 | 4.00 USD | 100.0%"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        under("### By model", table("model | Spend | Share", "claude-sonnet-5-5 | 4.00 USD | 100.0%")),
      );
    },
  );

  await then('"report.md" has the table "Reverts | Merged | Rate" with the row "0 | 1 | 0.0%"', async () => {
    expect(await readMarkdown(sut)).toContain(table("Reverts | Merged | Rate", "0 | 1 | 0.0%"));
  });
});
