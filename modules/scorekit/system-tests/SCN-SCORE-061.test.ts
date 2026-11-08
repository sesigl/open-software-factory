import { scenario } from "@opensoftware/testkit";
import { jsonl, scoreRecord } from "./runs.ts";

scenario("SCN-SCORE-061", async ({ sut, given, when, then }) => {
  await given('"scores.jsonl" whose second line is a JSON object with only the name "redundant-tests"', async () => {
    await sut.files.put("$INPUT/scores.jsonl", jsonl([scoreRecord("run-01", 1), { name: "redundant-tests" }]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit report scores.jsonl"', async () => {
    run = await sut.cli(["report", "scores.jsonl"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('the error output starts with "scorekit: scores.jsonl:2: not a score: "', async () => {
    expect(run.stderr.startsWith("scorekit: scores.jsonl:2: not a score: "), run.stderr).toBe(true);
  });
});
