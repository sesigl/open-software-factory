import { scenario } from "@opensoftware/testkit";
import { watchedRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";
import { codexSession } from "./sessions.ts";

scenario("SCN-RUN-055", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2026-01-01T09:59:45Z"',
    async () => {
      await watchedRepository(sut, "2026-01-01T09:59");
    },
  );

  await given(
    'the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69" that ended at "2026-01-01T10:00:13Z" in the folder "sessions"',
    async () => {
      await sut.files.put("$INPUT/sessions/codex/rollout.jsonl", codexSession());
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export --latest sessions"', async () => {
    run = await sut.cli(["export", "--latest", "sessions"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"runs.jsonl" has 1 run with "gen_ai.conversation.id" "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"',
    async () => {
      const runs = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(runs.map((exported) => exported.root.attributes["gen_ai.conversation.id"])).toEqual([
        "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69",
      ]);
    },
  );
});
