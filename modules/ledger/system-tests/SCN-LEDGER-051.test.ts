import { scenario } from "@opensoftware/testkit";
import { lines, readReport, runLine, sonnetPrices } from "./records.ts";

scenario("SCN-LEDGER-051", async ({ sut, given, when, then }) => {
  await given(
    '"prices.json" prices "claude-sonnet-5-5" at 0.000003 USD per input token, 0.000015 per output token, 0.0000003 per cache-read token and 0.00000375 per cache-write token',
    async () => {
      await sut.files.put(
        "$INPUT/prices.json",
        sonnetPrices({ cache_read_input_token_cost: 0.0000003, cache_creation_input_token_cost: 0.00000375 }),
      );
    },
  );

  await given(
    'the run "run-01" of "claude-sonnet-5-5" with 1000000 input tokens, of them 500000 cache-read and 200000 cache-write, and 100000 output tokens',
    async () => {
      const usage = { input: 1_000_000, cacheRead: 500_000, cacheWrite: 200_000, output: 100_000 };
      await sut.files.put("$INPUT/data.jsonl", lines(runLine("run-01", { model: "claude-sonnet-5-5", usage })));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger report --prices prices.json data.jsonl"', async () => {
    run = await sut.cli(["report", "--prices", "prices.json", "data.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"report.json" shows a total spend of 3.30 USD', async () => {
    expect((await readReport(sut)).spend.total).toBe(3.3);
  });
});
