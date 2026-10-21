import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { runsFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-017", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let api: FakeHttp;
  await given('a gateway that answers every judge call with the result "pass"', async () => {
    const answer = { choices: [{ message: { role: "assistant", content: verdict("pass", "Fine.") } }] };
    api = await fakes.http([{ method: "POST", path: "/v1/chat/completions", body: answer }]);
  });

  await when(
    'the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl" with "SCOREKIT_INFERENCE_KEY" set to "test-key"',
    async () => {
      await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs.jsonl"], {
        env: { SCOREKIT_INFERENCE_URL: `${api.url}/v1`, SCOREKIT_INFERENCE_KEY: "test-key" },
      });
    },
  );

  await then('the judge call carries the header "authorization" with "Bearer test-key"', async () => {
    expect(api.headers()).toMatchObject([
      { method: "POST", path: "/v1/chat/completions", headers: { authorization: "Bearer test-key" } },
    ]);
  });
});
