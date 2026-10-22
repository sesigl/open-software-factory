import { scenario } from "@opensoftware/testkit";
import { codexRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-068", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"',
    async () => {
      await codexRepository(sut);
    },
  );

  await when('the developer runs "runlog export rollout.jsonl"', async () => {
    await sut.cli(["export", "rollout.jsonl"]);
  });

  await then(
    'the spans in "runs.jsonl" are "invoke_agent", 2 "chat gpt-5-codex", "execute_tool shell" and "execute_tool apply_patch", in this order',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.spans.map((span) => span.name)).toEqual([
        "invoke_agent",
        "chat gpt-5-codex",
        "chat gpt-5-codex",
        "execute_tool shell",
        "execute_tool apply_patch",
      ]);
    },
  );
});
