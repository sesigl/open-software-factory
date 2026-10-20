import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";

scenario("SCN-RUN-013", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "runlog export session.jsonl" with OTEL_RESOURCE_ATTRIBUTES "osf.requester.kind=robot"',
    async () => {
      run = await sut.cli(["export", "session.jsonl"], {
        env: { OTEL_RESOURCE_ATTRIBUTES: "osf.requester.kind=robot" },
      });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "the run does not match the run-record contract: /resource/osf.requester.kind"',
    async () => {
      expect(run.stderr).toContain("the run does not match the run-record contract: /resource/osf.requester.kind");
    },
  );

  await then('the output folder has no "runs.jsonl"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("runs.jsonl");
  });
});
