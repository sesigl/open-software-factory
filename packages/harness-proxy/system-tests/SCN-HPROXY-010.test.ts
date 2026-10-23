import { scenario } from "@opensoftware/testkit";
import { exportDemo, serve } from "./proxy.ts";

scenario("SCN-HPROXY-010", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    "serveProxy ran a session with two turns of 1000 input and 200 output tokens each, after which the harness reported a cost of 0.25 USD and then 0.5 USD",
    async () => {
      const usage = { inputTokens: 1000, outputTokens: 200 };
      const harness = await fakes.harness([
        { when: "fix the typo", usage, costUsd: 0.25 },
        { when: "add a test", usage, costUsd: 0.5 },
      ]);
      const session = await (await serve(sut, harness)).newSession();
      sessionId = session.id;
      await session.prompt("fix the typo");
      await session.prompt("add a test");
    },
  );

  await when('the adapter exports the transcript of the session into "$OUTPUT"', async () => {
    exportDemo(sut, sessionId);
  });

  await then(
    '"$OUTPUT/run-record.json" has "gen_ai.usage.input_tokens" 2000, "gen_ai.usage.output_tokens" 400 and "osf.cost.usd" 0.5',
    async () => {
      const { span } = JSON.parse(await sut.files.read("$OUTPUT/run-record.json"));
      expect(span["gen_ai.usage.input_tokens"]).toBe(2000);
      expect(span["gen_ai.usage.output_tokens"]).toBe(400);
      expect(span["osf.cost.usd"]).toBe(0.5);
      expect(span).not.toHaveProperty("gen_ai.usage.cache_read.input_tokens");
    },
  );
});
