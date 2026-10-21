import { scenario } from "@opensoftware/testkit";
import { outputScores, runsFile, runsOf, verdict } from "./runs.ts";

scenario("SCN-SCORE-013", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the runs "run-01" and "run-02"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01", "run-02"]));
  });

  let url = "";
  await given(
    'a gateway that answers the first judge call with HTTP 503 and the second with the result "pass"',
    async () => {
      const answer = { choices: [{ message: { role: "assistant", content: verdict("pass", "Fine.") } }] };
      const api = await fakes.http([
        { method: "POST", path: "/v1/chat/completions", status: 503, body: { error: "busy" }, times: 1 },
        { method: "POST", path: "/v1/chat/completions", body: answer },
      ]);
      url = `${api.url}/v1`;
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"', async () => {
    run = await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: url },
    });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output contains "run-01: the judge call failed with HTTP 503"', async () => {
    expect(run.stderr).toContain("run-01: the judge call failed with HTTP 503");
  });

  await then('"scores.jsonl" holds scores for exactly the runs "run-02"', async () => {
    expect(runsOf(await outputScores(sut))).toEqual(["run-02"]);
  });
});
