import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { chatCalls, connect } from "./opencode.ts";

scenario("SCN-HOPENCODE-007", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done" }]);
  });

  let client: AcpClient;
  await given(
    'the adapter runs opencode with that gateway, "OPENAI_MODEL" "gpt-5.5" and "OSF_EFFORT" "low"',
    async () => {
      client = await connect(sut, gateway, { env: { OPENAI_MODEL: "gpt-5.5", OSF_EFFORT: "low" } });
    },
  );

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('every chat completions call the model gateway received has the reasoning effort "low"', async () => {
    const efforts = chatCalls(gateway).map((call) => call.reasoning_effort);
    expect(efforts.length).toBeGreaterThan(0);
    expect(new Set(efforts)).toEqual(new Set(["low"]));
  });
});
