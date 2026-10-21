import { scenario } from "@opensoftware/testkit";
import { lines, opened } from "./records.ts";

scenario("SCN-LEDGER-007", async ({ sut, given, when, then }) => {
  await given('the file "data.jsonl" whose line 2 is the text "hello world"', async () => {
    await sut.files.put("$INPUT/data.jsonl", lines(opened(1), "hello world"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger ingest data.jsonl"', async () => {
    run = await sut.cli(["ingest", "data.jsonl"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output says "data.jsonl:2: not a run, a spend row or a CloudEvent"', async () => {
    expect(run.stderr).toContain("data.jsonl:2: not a run, a spend row or a CloudEvent");
  });
});
