import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-059", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "runlog export session.jsonl --per-run" with OTEL_RESOURCE_ATTRIBUTES "osf.run.id=team/run:7"',
    async () => {
      run = await sut.cli(["export", "session.jsonl", "--per-run"], {
        env: { OTEL_RESOURCE_ATTRIBUTES: "osf.run.id=team/run:7" },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"team-run-7.jsonl" has 1 run with "osf.run.id" "team/run:7" on the resource', async () => {
    const runs = runsOf(await sut.files.read("$OUTPUT/team-run-7.jsonl"));
    expect(runs.map((exported) => exported.resource["osf.run.id"])).toEqual(["team/run:7"]);
  });
});
