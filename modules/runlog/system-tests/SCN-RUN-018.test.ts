import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";

scenario("SCN-RUN-018", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let endpoint: FakeHttp;
  await given("an OTLP endpoint that answers 400", async () => {
    endpoint = await fakes.http([{ method: "POST", path: "/v1/traces", status: 400, body: {} }]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "runlog export session.jsonl" with OTEL_EXPORTER_OTLP_ENDPOINT set to the endpoint',
    async () => {
      run = await sut.cli(["export", "session.jsonl"], { env: { OTEL_EXPORTER_OTLP_ENDPOINT: endpoint.url } });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "the OTLP endpoint refused the run"', async () => {
    expect(run.stderr).toContain("the OTLP endpoint refused the run");
  });
});
