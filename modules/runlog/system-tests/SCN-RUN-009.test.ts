import { scenario } from "@opensoftware/testkit";
import { codexRepository } from "./given.ts";
import { children, runsOf } from "./otlp.ts";

scenario("SCN-RUN-009", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"',
    async () => {
      await codexRepository(sut);
    },
  );

  await when('the developer runs "runlog export rollout.jsonl"', async () => {
    await sut.cli(["export", "rollout.jsonl"]);
  });

  await then('"runs.jsonl" has 2 spans "chat gpt-5-codex" below the root span', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported && children(exported, "chat gpt-5-codex")).toHaveLength(2);
  });

  await then('the second has "gen_ai.usage.input_tokens" 1400 and "gen_ai.usage.output_tokens" 60', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    const second = exported ? children(exported, "chat gpt-5-codex")[1] : undefined;
    expect(second?.attributes).toMatchObject({ "gen_ai.usage.input_tokens": 1400, "gen_ai.usage.output_tokens": 60 });
  });
});
