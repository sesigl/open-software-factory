import { scenario } from "@opensoftware/testkit";
import { codexRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-008", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"',
    async () => {
      await codexRepository(sut);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog export rollout.jsonl"', async () => {
    run = await sut.cli(["export", "rollout.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the root span in "runs.jsonl" has "gen_ai.provider.name" "openai", "gen_ai.request.model" "gpt-5-codex" and "gen_ai.conversation.id" "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.root.name).toBe("invoke_agent");
      expect(exported?.root.attributes).toMatchObject({
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.provider.name": "openai",
        "gen_ai.request.model": "gpt-5-codex",
        "gen_ai.conversation.id": "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69",
      });
    },
  );

  await then(
    'the root span has "gen_ai.usage.input_tokens" 2600, "gen_ai.usage.output_tokens" 100 and "gen_ai.usage.cache_read.input_tokens" 1300',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.root.attributes).toMatchObject({
        "gen_ai.usage.input_tokens": 2600,
        "gen_ai.usage.output_tokens": 100,
        "gen_ai.usage.cache_read.input_tokens": 1300,
      });
    },
  );

  await then('the resource has "osf.harness.name" "codex" and "osf.harness.version" "0.50.0"', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported?.resource).toMatchObject({ "osf.harness.name": "codex", "osf.harness.version": "0.50.0" });
  });
});
