import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-057", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export session.jsonl --per-run"', async () => {
    run = await sut.cli(["export", "session.jsonl", "--per-run"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d.jsonl" has 1 run with "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      const runs = runsOf(await sut.files.read("$OUTPUT/5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d.jsonl"));
      expect(runs.map((exported) => exported.root.attributes["gen_ai.conversation.id"])).toEqual([
        "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d",
      ]);
    },
  );

  await then('the output folder has no "runs.jsonl"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("runs.jsonl");
  });
});
