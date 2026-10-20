import { scenario } from "@opensoftware/testkit";
import { openCodeRepository } from "./given.ts";
import { children, runsOf } from "./otlp.ts";

scenario("SCN-RUN-023", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and the OpenCode session "ses_4c2e9a1b7f3dQ8mN2pR5tV6wXy"',
    async () => {
      await openCodeRepository(sut);
    },
  );

  await when('the developer runs "runlog export session.json"', async () => {
    await sut.cli(["export", "session.json"]);
  });

  await then('"runs.jsonl" has 2 spans "chat claude-sonnet-5-5" below the root span', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported && children(exported, "chat claude-sonnet-5-5")).toHaveLength(2);
  });

  await then(
    'the first has "gen_ai.response.id" "msg_a1", "gen_ai.usage.input_tokens" 1300 and "gen_ai.usage.output_tokens" 60',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      const [first] = exported ? children(exported, "chat claude-sonnet-5-5") : [];
      expect(first?.attributes).toMatchObject({
        "gen_ai.operation.name": "chat",
        "gen_ai.response.id": "msg_a1",
        "gen_ai.usage.input_tokens": 1300,
        "gen_ai.usage.output_tokens": 60,
      });
    },
  );
});
