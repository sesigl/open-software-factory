import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

const ATTRIBUTES =
  "osf.run.id=01JABCDRUN00000000000000001,osf.work_item.id=01JABCDWORK0000000000000001,osf.factory.version=3f2a9c1,osf.stage=implement,osf.requester.kind=person,osf.requester.id=slack:U024BE7LH,osf.source=slack";

scenario("SCN-RUN-011", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "runlog export session.jsonl" with OTEL_RESOURCE_ATTRIBUTES "osf.run.id=01JABCDRUN00000000000000001,osf.work_item.id=01JABCDWORK0000000000000001,osf.factory.version=3f2a9c1,osf.stage=implement,osf.requester.kind=person,osf.requester.id=slack:U024BE7LH,osf.source=slack"',
    async () => {
      run = await sut.cli(["export", "session.jsonl"], { env: { OTEL_RESOURCE_ATTRIBUTES: ATTRIBUTES } });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'every span in "runs.jsonl" has the resource attributes "osf.run.id" "01JABCDRUN00000000000000001", "osf.stage" "implement" and "osf.requester.id" "slack:U024BE7LH"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.spans.length).toBeGreaterThan(1);
      for (const span of exported?.spans ?? []) {
        expect(span.resource).toMatchObject({
          "osf.run.id": "01JABCDRUN00000000000000001",
          "osf.stage": "implement",
          "osf.requester.id": "slack:U024BE7LH",
        });
      }
    },
  );
});
