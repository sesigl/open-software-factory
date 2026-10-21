import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { created, LANGFUSE_KEYS, LIST, type Rule } from "./evaluators.ts";

scenario("SCN-SCORE-040", async ({ sut, fakes, given, when, then }) => {
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
    'the user runs "scorekit export --push --enable --scorer redundant-tests" with the public key "pk-lf-test" and the secret key "sk-lf-test"',
    async () => {
      run = await sut.cli(["export", "--push", "--enable", "--scorer", "redundant-tests"], {
        env: { LANGFUSE_HOST: langfuse.url, ...LANGFUSE_KEYS },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'Langfuse received the enabled rule "scorekit redundant-tests" at "POST /api/public/v2/evaluation-rules"',
    async () => {
      const [request] = langfuse.received().filter((one) => one.path === "/api/public/v2/evaluation-rules");
      expect(request?.method).toBe("POST");
      const rule = request?.body as Rule;
      expect(rule.name).toBe("scorekit redundant-tests");
      expect(rule.enabled).toBe(true);
    },
  );
});
