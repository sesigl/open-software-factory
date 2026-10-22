import { scenario } from "@opensoftware/testkit";
import { lines, runLine } from "./records.ts";

scenario("SCN-LEDGER-064", async ({ sut, given, when, then }) => {
  await given('"prices.json" with the text "not json"', async () => {
    await sut.files.put("$INPUT/prices.json", "not json\n");
  });

  await given('the run "run-01" of "claude-sonnet-5-5" with 1000000 input tokens', async () => {
    const run = runLine("run-01", { model: "claude-sonnet-5-5", usage: { input: 1_000_000 } });
    await sut.files.put("$INPUT/data.jsonl", lines(run));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger report --prices prices.json data.jsonl"', async () => {
    run = await sut.cli(["report", "--prices", "prices.json", "data.jsonl"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "prices.json: not a LiteLLM price table: an object with one entry per model"',
    async () => {
      expect(run.stderr).toContain("prices.json: not a LiteLLM price table: an object with one entry per model");
    },
  );
});
