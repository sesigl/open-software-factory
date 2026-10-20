import { scenario } from "@opensoftware/testkit";
import { codexRepository } from "./given.ts";
import { children, runsOf } from "./otlp.ts";

scenario("SCN-RUN-010", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the Codex session "7f9c2b1a-5d3e-4c8f-9b0a-1e2d3c4b5a69"',
    async () => {
      await codexRepository(sut);
    },
  );

  await when('the developer runs "runlog export rollout.jsonl"', async () => {
    await sut.cli(["export", "rollout.jsonl"]);
  });

  await then('"runs.jsonl" has 1 span "execute_tool shell" below the root span', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported && children(exported, "execute_tool shell")).toHaveLength(1);
  });

  await then('it has "gen_ai.tool.call.id" "call_01" and lasts 8 seconds', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    const [call] = exported ? children(exported, "execute_tool shell") : [];
    expect(call?.attributes["gen_ai.tool.call.id"]).toBe("call_01");
    expect(call?.seconds).toBe(8);
  });
});
