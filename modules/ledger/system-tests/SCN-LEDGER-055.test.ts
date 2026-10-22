import { scenario } from "@opensoftware/testkit";
import { lines, pricesFile, runLine } from "./records.ts";

scenario("SCN-LEDGER-055", async ({ sut, given, when, then }) => {
  await given('"prices.json" prices "claude-sonnet-5-5" at "cheap" per input token', async () => {
    const entry = { input_cost_per_token: "cheap", output_cost_per_token: 0.000015 };
    await sut.files.put("$INPUT/prices.json", pricesFile({ "claude-sonnet-5-5": entry }));
  });

  await given('the run "run-01" of "claude-sonnet-5-5" with 1000000 input tokens', async () => {
    const run = runLine("run-01", { model: "claude-sonnet-5-5", usage: { input: 1_000_000 } });
    await sut.files.put("$INPUT/data.jsonl", lines(run));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger ingest --prices prices.json data.jsonl"', async () => {
    run = await sut.cli(["ingest", "--prices", "prices.json", "data.jsonl"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output names "prices.json", "claude-sonnet-5-5" and "input_cost_per_token"', async () => {
    expect(run.stderr).toContain("prices.json");
    expect(run.stderr).toContain("claude-sonnet-5-5");
    expect(run.stderr).toContain("input_cost_per_token");
  });

  await then('"ledger query \'SELECT count(*) AS runs FROM run_cost\'" prints {"runs":0}', async () => {
    const query = await sut.cli(["query", "SELECT count(*) AS runs FROM run_cost"]);
    expect(query.stdout.trim()).toBe('{"runs":0}');
  });
});
