import { scenario } from "@opensoftware/testkit";
import { closed, lines, opened, pageText, runLine, spanIdOf } from "./records.ts";

scenario("SCN-LEDGER-058", async ({ sut, given, when, then }) => {
  await given(
    "2 merged pull requests, one of them titled 'Revert \"Change 1\"', and 3 runs of which 1 runs below another",
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          opened(1),
          opened(2, { title: 'Revert "Change 1"' }),
          closed(1, "2026-01-05T12:00:00Z"),
          closed(2, "2026-01-05T13:00:00Z"),
          runLine("run-01"),
          runLine("run-02", { parent: { run: "run-01", span: spanIdOf("run-01", 1) } }),
          runLine("run-03"),
        ),
      );
    },
  );

  await when('the user runs "ledger report --html ledger.html data.jsonl"', async () => {
    const run = await sut.cli(["report", "--html", "ledger.html", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"ledger.html" shows "Pull requests merged 2", "Runs 3", "Top-level runs 2" and "Revert rate 50.0%"',
    async () => {
      const text = await pageText(sut);
      for (const shown of ["Pull requests merged 2", "Runs 3", "Top-level runs 2", "Revert rate 50.0%"])
        expect(text).toContain(shown);
    },
  );
});
