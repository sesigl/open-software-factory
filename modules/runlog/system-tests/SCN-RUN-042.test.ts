import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { watchedRepository } from "./given.ts";

scenario("SCN-RUN-042", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"',
    async () => {
      await watchedRepository(sut, "2025-12-31T23:50");
    },
  );

  let endpoint: FakeHttp;
  await given("an OTLP endpoint that answers 400 once and then accepts traces", async () => {
    endpoint = await fakes.http([
      { method: "POST", path: "/v1/traces", status: 400, body: {}, times: 1 },
      { method: "POST", path: "/v1/traces", body: {} },
    ]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "runlog watch sessions --passes 2 --interval 0" with OTEL_EXPORTER_OTLP_ENDPOINT set to the endpoint',
    async () => {
      run = await sut.cli(["watch", "sessions", "--passes", "2", "--interval", "0"], {
        env: { OTEL_EXPORTER_OTLP_ENDPOINT: endpoint.url },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "session.jsonl: the OTLP endpoint refused the run"', async () => {
    expect(run.stderr).toContain("session.jsonl: the OTLP endpoint refused the run");
  });

  await then('the endpoint received "POST /v1/traces" twice', async () => {
    expect(endpoint.requests()).toEqual(["POST /v1/traces", "POST /v1/traces"]);
  });
});
