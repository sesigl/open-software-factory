import { scenario } from "@opensoftware/testkit";
import { lines, pageText, runLine, spendRow } from "./records.ts";

scenario("SCN-LEDGER-062", async ({ sut, given, when, then }) => {
  await given(
    'a run with the source "slack", the requester "github:mona", the agent "implementer" and the model "claude-sonnet-5-5" and spend rows of 3.00 USD',
    async () => {
      const run = runLine("run-01", {
        source: "slack",
        requester: "github:mona",
        agent: "implementer",
        model: "claude-sonnet-5-5",
      });
      await sut.files.put("$INPUT/data.jsonl", lines(run, spendRow("req-1", 3, { run: "run-01" })));
    },
  );

  await given('a spend row of 1.00 USD of the model "claude-haiku-5-5" without a run', async () => {
    const row = spendRow("req-2", 1, { model: "claude-haiku-5-5" });
    await sut.files.put("$INPUT/data.jsonl", (await sut.files.read("$INPUT/data.jsonl")) + lines(row));
  });

  await when('the user runs "ledger report --html ledger.html data.jsonl"', async () => {
    const run = await sut.cli(["report", "--html", "ledger.html", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"ledger.html" shows "Unattributed 1.00 USD"', async () => {
    expect(await pageText(sut)).toContain("Unattributed 1.00 USD");
  });

  await then(
    '"ledger.html" shows "slack 3.00 USD 75.0%", "github:mona 3.00 USD 75.0%", "implementer 3.00 USD 75.0%" and "claude-sonnet-5-5 3.00 USD 75.0%"',
    async () => {
      const text = await pageText(sut);
      for (const name of ["slack", "github:mona", "implementer", "claude-sonnet-5-5"])
        expect(text).toContain(`${name} 3.00 USD 75.0%`);
    },
  );
});
