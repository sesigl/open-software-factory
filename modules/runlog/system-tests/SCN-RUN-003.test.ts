import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-003", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      await claudeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export session.jsonl"', async () => {
    run = await sut.cli(["export", "session.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the root span in "runs.jsonl" has "gen_ai.provider.name" "anthropic" and "gen_ai.request.model" "claude-sonnet-5-5"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.root.attributes).toMatchObject({
        "gen_ai.provider.name": "anthropic",
        "gen_ai.request.model": "claude-sonnet-5-5",
      });
    },
  );

  await then(
    'the root span has "gen_ai.usage.input_tokens" 7400, "gen_ai.usage.output_tokens" 150 and "gen_ai.usage.cache_read.input_tokens" 3000',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.root.attributes).toMatchObject({
        "gen_ai.usage.input_tokens": 7400,
        "gen_ai.usage.output_tokens": 150,
        "gen_ai.usage.cache_read.input_tokens": 3000,
      });
    },
  );
});
