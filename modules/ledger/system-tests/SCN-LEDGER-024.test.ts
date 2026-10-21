import { scenario } from "@opensoftware/testkit";
import { closed, lines, opened, readReport } from "./records.ts";

scenario("SCN-LEDGER-024", async ({ sut, given, when, then }) => {
  await given(
    "2 pull requests opened on 2026-01-05, one of them merged on 2026-01-06, and 1 opened on 2026-01-06",
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          opened(1, { at: "2026-01-05T09:00:00Z" }),
          opened(2, { at: "2026-01-05T15:00:00Z" }),
          closed(1, "2026-01-06T10:00:00Z"),
          closed(2, "2026-01-06T11:00:00Z", false),
          opened(3, { at: "2026-01-06T09:00:00Z" }),
        ),
      );
    },
  );

  await when('the user runs "ledger report data.jsonl"', async () => {
    expect((await sut.cli(["report", "data.jsonl"])).exitCode).toBe(0);
  });

  await then(
    '"report.json" shows on "2026-01-05" 2 opened and 0 merged, and on "2026-01-06" 1 opened and 1 merged',
    async () => {
      expect((await readReport(sut)).pullRequests.perDay).toEqual([
        { date: "2026-01-05", opened: 2, merged: 0 },
        { date: "2026-01-06", opened: 1, merged: 1 },
      ]);
    },
  );
});
