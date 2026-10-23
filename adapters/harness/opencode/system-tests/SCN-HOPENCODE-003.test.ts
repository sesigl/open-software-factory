import { scenario } from "@opensoftware/testkit";
import { connect } from "./opencode.ts";

scenario("SCN-HOPENCODE-003", async ({ sut, fakes, given, when, then }) => {
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

  await then(
    '"$OUTPUT/run-record.json" has "gen_ai.usage.input_tokens" 1000 and "gen_ai.usage.output_tokens" 200',
    async () => {
      const { span } = JSON.parse(await sut.files.read("$OUTPUT/run-record.json"));
      expect(span["gen_ai.usage.input_tokens"]).toBe(1000);
      expect(span["gen_ai.usage.output_tokens"]).toBe(200);
    },
  );
});
