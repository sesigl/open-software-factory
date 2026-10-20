import { scenario } from "@opensoftware/testkit";
import { openCodeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-022", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"',
    async () => {
      await openCodeRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export session.json"', async () => {
    run = await sut.cli(["export", "session.json"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the root span in "runs.jsonl" has "gen_ai.provider.name" "anthropic", "gen_ai.request.model" "claude-sonnet-5-5" and "gen_ai.conversation.id" "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.root.name).toBe("invoke_agent");
      expect(exported?.root.attributes).toMatchObject({
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.provider.name": "anthropic",
        "gen_ai.request.model": "claude-sonnet-5-5",
        "gen_ai.conversation.id": "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy",
      });
    },
  );

  await then(
    'the root span has "gen_ai.usage.input_tokens" 2800, "gen_ai.usage.output_tokens" 80 and "gen_ai.usage.cache_read.input_tokens" 1600',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.root.attributes).toMatchObject({
        "gen_ai.usage.input_tokens": 2800,
        "gen_ai.usage.output_tokens": 80,
        "gen_ai.usage.cache_read.input_tokens": 1600,
        "gen_ai.usage.cache_write.input_tokens": 100,
      });
    },
  );

  await then('the resource has "osf.harness.name" "opencode" and "osf.harness.version" "1.18.2"', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported?.resource).toMatchObject({ "osf.harness.name": "opencode", "osf.harness.version": "1.18.2" });
  });
});
