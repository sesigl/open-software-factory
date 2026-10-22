import { scenario } from "@opensoftware/testkit";
import { lines, readReport, runLine, sonnetPrices } from "./records.ts";

scenario("SCN-LEDGER-052", async ({ sut, given, when, then }) => {
  await given(
    '"prices.json" prices "claude-sonnet-5-5" at 0.000003 USD per input token and 0.000015 per output token',
    async () => {
      await sut.files.put("$INPUT/prices.json", sonnetPrices());
    },
  );

  await given('the run "run-01" of "claude-sonnet-5-5" with the cost 1.25 USD and 1000000 input tokens', async () => {
    const run = runLine("run-01", { model: "claude-sonnet-5-5", cost: 1.25, usage: { input: 1_000_000 } });
    await sut.files.put("$INPUT/data.jsonl", lines(run));
  });

  await when('the user runs "ledger report --prices prices.json data.jsonl"', async () => {
    const run = await sut.cli(["report", "--prices", "prices.json", "data.jsonl"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"report.json" shows a total spend of 1.25 USD', async () => {
    expect((await readReport(sut)).spend.total).toBe(1.25);
  });
});
