import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runOf } from "./otlp.ts";

scenario("SCN-RUN-017", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let endpoint: FakeHttp;
  await given("an OTLP endpoint that answers 503 once and then accepts traces", async () => {
    endpoint = await fakes.http([
      { method: "POST", path: "/v1/traces", status: 503, body: {}, times: 1 },
      { method: "POST", path: "/v1/traces", body: {} },
    ]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "runlog export session.jsonl" with OTEL_EXPORTER_OTLP_ENDPOINT set to the endpoint',
    async () => {
      run = await sut.cli(["export", "session.jsonl"], { env: { OTEL_EXPORTER_OTLP_ENDPOINT: endpoint.url } });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the endpoint received "POST /v1/traces" twice with the same run', async () => {
    const received = endpoint.received();
    expect(received.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /v1/traces",
      "POST /v1/traces",
    ]);
    expect(runOf(received[1]?.body).root.traceId).toBe(runOf(received[0]?.body).root.traceId);
  });
});
