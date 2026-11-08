import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { outputScores, runIds, runsFile, verdict } from "./runs.ts";

const route = (body: unknown) => ({ method: "POST", path: "/v1/chat/completions", body, times: 1 });

scenario("SCN-SCORE-054", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the runs "run-01" to "run-04"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(runIds(4)));
  });

  let api: FakeHttp;
  await given(
    'a gateway at a URL with a trailing slash that answers "run-01" with the model "judge-2026-01" and the result "pass", "run-02" without choices, "run-03" with no choice and "run-04" with a choice without a message',
    async () => {
      // The script answers the calls in order; scorekit judges the runs in the order of the runs file.
      api = await fakes.http([
        route({
          model: "judge-2026-01",
          choices: [{ message: { role: "assistant", content: verdict("pass", "Fine.") } }],
        }),
        route({}),
        route({ choices: [] }),
        route({ choices: [{}] }),
      ]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"', async () => {
    run = await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: `${api.url}/v1//` },
    });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the gateway received each judge call at "POST /v1/chat/completions" with the header "content-type" "application/json"',
    async () => {
      const calls = api.headers();
      expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(
        runIds(4).map(() => "POST /v1/chat/completions"),
      );
      for (const call of calls) expect(call.headers["content-type"]).toBe("application/json");
    },
  );

  await then('the score for "run-01" carries the judge model "judge-2026-01"', async () => {
    expect(await outputScores(sut)).toMatchObject([
      { metadata: { "osf.run.id": "run-01", "osf.judge.model": "judge-2026-01" } },
    ]);
  });

  await then(
    `the error output says for "run-02", "run-03" and "run-04" that the judge's answer is not a verdict`,
    async () => {
      expect(run.stderr).toBe(
        ["run-02", "run-03", "run-04"].map((id) => `scorekit: ${id}: the judge's answer is not a verdict: \n`).join(""),
      );
    },
  );
});
