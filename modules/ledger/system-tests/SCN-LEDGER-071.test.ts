import { scenario } from "@opensoftware/testkit";
import { lines, mergedFrom, pageText } from "./records.ts";

scenario("SCN-LEDGER-071", async ({ sut, given, when, then }) => {
  await given(
    `merged pull requests from the head branches "osf/run-01" and "fix-login", and a merged pull request 'Revert "Change 1"' from the head branch "revert-1-osf/run-01"`,
    async () => {
      await sut.files.put(
        "$INPUT/data.jsonl",
        lines(
          ...mergedFrom(1, "osf/run-01"),
          ...mergedFrom(2, "fix-login"),
          ...mergedFrom(3, "revert-1-osf/run-01", { title: 'Revert "Change 1"', at: "2026-01-07T10:00:00Z" }),
        ),
      );
    },
  );

  await when('the user runs "ledger report --html ledger.html data.jsonl"', async () => {
    const run = await sut.cli(["report", "--html", "ledger.html", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"ledger.html" shows "Factory share 33.3%", "Revert rate of the factory 100.0%" and "Revert rate of people 0.0%"',
    async () => {
      const text = await pageText(sut);
      for (const shown of ["Factory share 33.3%", "Revert rate of the factory 100.0%", "Revert rate of people 0.0%"])
        expect(text).toContain(shown);
    },
  );
});
