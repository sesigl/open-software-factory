import { scenario } from "@opensoftware/testkit";
import { watchedRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-033", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:58:45Z"',
    async () => {
      await watchedRepository(sut, "2025-12-31T23:58");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog watch sessions --passes 1 --idle 1"', async () => {
    run = await sut.cli(["watch", "sessions", "--passes", "1", "--idle", "1"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"runs.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      const runs = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(runs.map((exported) => exported.root.attributes["gen_ai.conversation.id"])).toEqual([
        "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d",
      ]);
    },
  );
});
