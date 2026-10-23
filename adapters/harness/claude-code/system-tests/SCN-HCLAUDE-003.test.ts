import { scenario } from "@opensoftware/testkit";
import { connect, linesOf } from "./claude.ts";

scenario("SCN-HCLAUDE-003", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'the adapter ran a session in which the model gateway answered "fix the typo" with "done", 1000 prompt tokens and 200 completion tokens',
    async () => {
      const usage = { prompt_tokens: 1000, completion_tokens: 200 };
      const gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done", usage }]);
      const session = await (await connect(sut, gateway)).newSession();
      sessionId = session.id;
      await session.prompt("fix the typo");
    },
  );

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  let span: Record<string, unknown>;
  await then(
    '"$OUTPUT/run-record.json" has "gen_ai.usage.input_tokens" 1000 and "gen_ai.usage.output_tokens" 200',
    async () => {
      span = JSON.parse(await sut.files.read("$OUTPUT/run-record.json")).span;
      expect(span["gen_ai.usage.input_tokens"]).toBe(1000);
      expect(span["gen_ai.usage.output_tokens"]).toBe(200);
    },
  );

  await then('its "osf.cost.usd" is the last cost in "$OUTPUT/transcript.jsonl", above 0', async () => {
    const costs = (await linesOf(sut, "$OUTPUT/transcript.jsonl")).flatMap((line) => {
      const update = line.update as { sessionUpdate?: string; cost?: { amount: number; currency: string } } | undefined;
      return update?.sessionUpdate === "usage_update" && update.cost ? [update.cost] : [];
    });
    expect(costs.at(-1)?.currency).toBe("USD");
    expect(span["osf.cost.usd"]).toBe(costs.at(-1)?.amount);
    expect(span["osf.cost.usd"]).toBeGreaterThan(0);
  });
});
