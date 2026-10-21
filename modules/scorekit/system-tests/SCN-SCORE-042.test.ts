import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { type Evaluator, entryOf, LANGFUSE_KEYS, LIST, listed, readEntries } from "./evaluators.ts";

scenario("SCN-SCORE-042", async ({ sut, fakes, given, when, then }) => {
  let langfuse: FakeHttp;
  await given(
    'a Langfuse project with the evaluator "redundant-tests" whose prompt is "An older prompt." and a rule',
    async () => {
      const exported = await sut.cli(["export", "--scorer", "redundant-tests"]);
      expect(exported.exitCode, exported.stderr).toBe(0);
      const { evaluator } = entryOf(await readEntries(sut), "redundant-tests");
      const older = listed(evaluator, "ev-7", { prompt: [{ role: "user", content: "An older prompt." }] });
      langfuse = await fakes.http([
        { path: LIST, body: { data: [older], meta: {} } },
        { method: "PATCH", path: "/api/public/v2/evaluators/ev-7", body: { ...older, version: 2 } },
      ]);
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

  await then(
    'Langfuse received the new definition of "redundant-tests" at "PATCH /api/public/v2/evaluators/ev-7"',
    async () => {
      const [request] = langfuse.received().filter((one) => one.method === "PATCH");
      expect(request?.path).toBe("/api/public/v2/evaluators/ev-7");
      const evaluator = request?.body as Evaluator;
      expect(evaluator.type).toBe("llm_as_judge");
      expect(evaluator.prompt[0]?.content).toContain("Pass criterion: Every test the agent added or changed");
      expect(evaluator.outputDefinition.dataType).toBe("BOOLEAN");
    },
  );

  await then('Langfuse received no request to "/api/public/v2/evaluation-rules"', async () => {
    expect(langfuse.requests().filter((line) => line.includes("/api/public/v2/evaluation-rules"))).toEqual([]);
  });

  await then('the output says "updated redundant-tests"', async () => {
    expect(run.stdout).toContain("updated redundant-tests");
  });
});
