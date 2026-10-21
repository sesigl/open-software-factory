import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { jsonl, scoreRecord } from "./runs.ts";

scenario("SCN-SCORE-026", async ({ sut, fakes, given, when, then }) => {
  const scores = [scoreRecord("run-01", 1), scoreRecord("run-02", 0)];
  await given('"scores.jsonl" with 2 scores of "redundant-tests"', async () => {
    await sut.files.put("$INPUT/scores.jsonl", jsonl(scores));
  });

  let langfuse: FakeHttp;
  await given("a Langfuse API that accepts scores", async () => {
    langfuse = await fakes.http([{ method: "POST", path: "/api/public/scores", body: { id: "accepted" } }]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit push scores.jsonl" with the public key "pk-lf-test" and the secret key "sk-lf-test"',
    async () => {
      run = await sut.cli(["push", "scores.jsonl"], {
        env: { LANGFUSE_HOST: langfuse.url, LANGFUSE_PUBLIC_KEY: "pk-lf-test", LANGFUSE_SECRET_KEY: "sk-lf-test" },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('Langfuse received the 2 scores at "POST /api/public/scores"', async () => {
    expect(langfuse.received()).toEqual(
      scores.map((score) => ({ method: "POST", path: "/api/public/scores", body: score })),
    );
  });

  await then('each request carries the header "authorization" with "Basic cGstbGYtdGVzdDpzay1sZi10ZXN0"', async () => {
    const auth = langfuse.headers().map((request) => request.headers.authorization);
    expect(auth).toEqual(["Basic cGstbGYtdGVzdDpzay1sZi10ZXN0", "Basic cGstbGYtdGVzdDpzay1sZi10ZXN0"]);
  });
});
