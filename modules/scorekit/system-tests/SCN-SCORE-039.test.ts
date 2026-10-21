import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { BASIC_AUTH, created, type Evaluator, LANGFUSE_KEYS, LIST, type Rule } from "./evaluators.ts";

scenario("SCN-SCORE-039", async ({ sut, fakes, given, when, then }) => {
  let langfuse: FakeHttp;
  await given("a Langfuse project without evaluators", async () => {
    langfuse = await fakes.http([
      { path: LIST, body: { data: [], meta: {} } },
      { method: "POST", path: "/api/public/v2/evaluators", status: 201, body: created("ev-1") },
      { method: "POST", path: "/api/public/v2/evaluation-rules", status: 201, body: { id: "rule-1" } },
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

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('Langfuse received the evaluator "redundant-tests" at "POST /api/public/v2/evaluators"', async () => {
    const [request] = langfuse.received().filter((one) => one.method === "POST" && one.path.endsWith("/evaluators"));
    const evaluator = request?.body as Evaluator;
    expect(evaluator.name).toBe("redundant-tests");
    expect(evaluator.type).toBe("llm_as_judge");
    expect(evaluator.prompt[0]?.content).toContain("Pass criterion: Every test the agent added or changed");
    expect(evaluator.outputDefinition.dataType).toBe("BOOLEAN");
  });

  await then(
    'Langfuse received the disabled rule "scorekit redundant-tests" for the evaluator "ev-1" at "POST /api/public/v2/evaluation-rules"',
    async () => {
      const [request] = langfuse.received().filter((one) => one.path === "/api/public/v2/evaluation-rules");
      expect(request?.method).toBe("POST");
      const rule = request?.body as Rule & { evaluatorAssignments: unknown };
      expect(rule.name).toBe("scorekit redundant-tests");
      expect(rule.enabled).toBe(false);
      expect(rule.sampling).toBe(0.2);
      expect(rule.evaluatorAssignments).toEqual([{ evaluatorId: "ev-1" }]);
    },
  );

  await then('each request carries the header "authorization" with "Basic cGstbGYtdGVzdDpzay1sZi10ZXN0"', async () => {
    const auth = langfuse.headers().map((request) => request.headers.authorization);
    expect(auth).toEqual([BASIC_AUTH, BASIC_AUTH, BASIC_AUTH]);
  });

  await then('the output says "created redundant-tests"', async () => {
    expect(run.stdout).toContain("created redundant-tests");
  });
});
