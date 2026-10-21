import { scenario } from "@opensoftware/testkit";
import { lines, opened, readReport, spendRow } from "./records.ts";

scenario("SCN-LEDGER-027", async ({ sut, given, when, then }) => {
  await given("a pull request opened on 2026-01-04 with spend rows of 5.00 USD on that day", async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      lines(opened(1, { at: "2026-01-04T09:00:00Z" }), spendRow("req-1", 5, { at: "2026-01-04T23:59:00Z" })),
    );
  });

  await given("a pull request opened on 2026-01-05 with spend rows of 2.00 USD on that day", async () => {
    await sut.files.put(
      "$INPUT/data.jsonl",
      (await sut.files.read("$INPUT/data.jsonl")) +
        lines(opened(2, { at: "2026-01-05T23:00:00Z" }), spendRow("req-2", 2, { at: "2026-01-05T00:00:00Z" })),
    );
  });

  await when('the user runs "ledger report --since 2026-01-05 --until 2026-01-05 data.jsonl"', async () => {
    const run = await sut.cli(["report", "--since", "2026-01-05", "--until", "2026-01-05", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"report.json" shows the period from "2026-01-05" to "2026-01-05", 1 pull request and a total spend of 2.00 USD',
    async () => {
      const report = await readReport(sut);
      expect(report.period).toEqual({ since: "2026-01-05", until: "2026-01-05" });
      expect(report.pullRequests.opened).toBe(1);
      expect(report.spend.total).toBe(2);
    },
  );
});
