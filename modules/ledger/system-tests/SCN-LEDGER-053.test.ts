import { scenario } from "@opensoftware/testkit";
import { lines, readReport, runLine, sonnetPrices } from "./records.ts";

scenario("SCN-LEDGER-053", async ({ sut, given, when, then }) => {
  await given(
    '"prices.json" prices "claude-sonnet-5-5" at 0.000003 USD per input token and 0.000015 per output token',
    async () => {
      await sut.files.put("$INPUT/prices.json", sonnetPrices());
    },
  );

  await given('the run "run-01" of "claude-mystery-1" with 1000000 input tokens', async () => {
    const run = runLine("run-01", { model: "claude-mystery-1", usage: { input: 1_000_000 } });
    await sut.files.put("$INPUT/data.jsonl", lines(run));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger report --prices prices.json data.jsonl"', async () => {
    run = await sut.cli(["report", "--prices", "prices.json", "data.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    "the output says 'no price in prices.json for the model \"claude-mystery-1\": 1 run without cost'",
    async () => {
      expect(run.stdout.split("\n")).toContain(
        'no price in prices.json for the model "claude-mystery-1": 1 run without cost',
      );
    },
  );

  await then('"report.json" shows a total spend of 0.00 USD', async () => {
    expect((await readReport(sut)).spend.total).toBe(0);
  });
});
