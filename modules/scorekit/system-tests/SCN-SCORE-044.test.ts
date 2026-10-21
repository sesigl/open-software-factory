import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { LANGFUSE_KEYS, LIST } from "./evaluators.ts";

scenario("SCN-SCORE-044", async ({ sut, fakes, given, when, then }) => {
  let langfuse: FakeHttp;
  await given("a Langfuse project without evaluators that answers HTTP 400 to a new evaluator", async () => {
    langfuse = await fakes.http([
      { path: LIST, body: { data: [], meta: {} } },
      { method: "POST", path: "/api/public/v2/evaluators", status: 400, body: { message: "invalid prompt" } },
    ]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit export --push --scorer redundant-tests" with the public key "pk-lf-test" and the secret key "sk-lf-test"',
    async () => {
      run = await sut.cli(["export", "--push", "--scorer", "redundant-tests"], {
        env: { LANGFUSE_HOST: langfuse.url, ...LANGFUSE_KEYS },
      });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output says "evaluator redundant-tests: Langfuse answered HTTP 400"', async () => {
    expect(run.stderr).toContain("evaluator redundant-tests: Langfuse answered HTTP 400");
  });
});
