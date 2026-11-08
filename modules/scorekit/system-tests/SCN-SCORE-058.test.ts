import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { jsonl, scoreRecord } from "./runs.ts";

scenario("SCN-SCORE-058", async ({ sut, fakes, given, when, then }) => {
  await given('"scores.jsonl" with 2 scores of "redundant-tests"', async () => {
    await sut.files.put("$INPUT/scores.jsonl", jsonl([scoreRecord("run-01", 1), scoreRecord("run-02", 0)]));
  });

  let langfuse: FakeHttp;
  await given(
    "a Langfuse API at a host with a trailing slash that answers the first score with HTTP 500 and accepts the second",
    async () => {
      langfuse = await fakes.http([
        { method: "POST", path: "/api/public/scores", status: 500, body: { error: "down" }, times: 1 },
        { method: "POST", path: "/api/public/scores", body: { id: "accepted" } },
      ]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit push scores.jsonl" with the public key "pk-lf-test" and the secret key "sk-lf-test"',
    async () => {
      run = await sut.cli(["push", "scores.jsonl"], {
        env: {
          LANGFUSE_HOST: `${langfuse.url}//`,
          LANGFUSE_PUBLIC_KEY: "pk-lf-test",
          LANGFUSE_SECRET_KEY: "sk-lf-test",
        },
      });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output is "pushed 1 of 2 scores to Langfuse"', async () => {
    expect(run.stdout).toBe("pushed 1 of 2 scores to Langfuse\n");
  });

  await then(
    'Langfuse received both scores at "POST /api/public/scores" with the header "content-type" "application/json"',
    async () => {
      const calls = langfuse.headers();
      expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
        "POST /api/public/scores",
        "POST /api/public/scores",
      ]);
      for (const call of calls) expect(call.headers["content-type"]).toBe("application/json");
    },
  );
});
