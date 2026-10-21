import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { entryOf, LANGFUSE_KEYS, LIST, listed, readEntries } from "./evaluators.ts";

scenario("SCN-SCORE-041", async ({ sut, fakes, given, when, then }) => {
  let langfuse: FakeHttp;
  await given(
    'a Langfuse project with the evaluator "redundant-tests" exported from the same scorer file and a rule',
    async () => {
      const exported = await sut.cli(["export", "--scorer", "redundant-tests"]);
      expect(exported.exitCode, exported.stderr).toBe(0);
      const { evaluator } = entryOf(await readEntries(sut), "redundant-tests");
      langfuse = await fakes.http([{ path: LIST, body: { data: [listed(evaluator, "ev-7")], meta: {} } }]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit export --push --scorer redundant-tests" with the public key "pk-lf-test" and the secret key "sk-lf-test"',
    async () => {
      run = await sut.cli(["export", "--push", "--scorer", "redundant-tests"], {
        env: { LANGFUSE_HOST: langfuse.url, ...LANGFUSE_KEYS },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('Langfuse received only "GET /api/public/v2/evaluators?limit=100"', async () => {
    expect(langfuse.requests()).toEqual([`GET ${LIST}`]);
  });

  await then('the output says "unchanged redundant-tests"', async () => {
    expect(run.stdout).toContain("unchanged redundant-tests");
  });
});
