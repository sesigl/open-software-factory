import { scenario } from "@opensoftware/testkit";
import { closed, lines, opened, readMarkdown, readReport, table, under } from "./records.ts";

scenario("SCN-LEDGER-069", async ({ sut, given, when, then }) => {
  const events: unknown[] = [];
  await given('a pull request from the head branch "osf/run-01" merged on 2026-01-04', async () => {
    events.push(opened(1, { branch: "osf/run-01", at: "2026-01-04T09:00:00Z" }), closed(1, "2026-01-04T12:00:00Z"));
  });

  await given('a pull request from the head branch "fix-login" merged on 2026-01-05', async () => {
    events.push(opened(2, { branch: "fix-login", at: "2026-01-05T09:00:00Z" }), closed(2, "2026-01-05T12:00:00Z"));
    await sut.files.put("$INPUT/data.jsonl", lines(...events));
  });

  await when(
    'the user runs "ledger report --since 2026-01-05 --until 2026-01-05 --markdown report.md data.jsonl"',
    async () => {
      const run = await sut.cli([
        "report",
        "--since",
        "2026-01-05",
        "--until",
        "2026-01-05",
        "--markdown",
        "report.md",
        "data.jsonl",
      ]);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then(
    '"report.json" shows 0 merged pull requests of the factory, a share of 0 and the revert rate null',
    async () => {
      expect((await readReport(sut)).origin.factory).toEqual({ merged: 0, share: 0, reverts: 0, revertRate: null });
    },
  );

  await then(
    '"report.md" has under "## Factory and people" the table "Origin | Merged | Share | Reverts | Revert rate" with the rows "Factory | 0 | 0.0% | 0 | -" and "People | 1 | 100.0% | 0 | 0.0%"',
    async () => {
      expect(await readMarkdown(sut)).toContain(
        under(
          "## Factory and people",
          table(
            "Origin | Merged | Share | Reverts | Revert rate",
            "Factory | 0 | 0.0% | 0 | -",
            "People | 1 | 100.0% | 0 | 0.0%",
          ),
        ),
      );
    },
  );
});
