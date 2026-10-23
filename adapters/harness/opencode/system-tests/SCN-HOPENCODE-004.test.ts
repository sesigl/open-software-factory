import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { chatCalls, connect } from "./opencode.ts";

scenario("SCN-HOPENCODE-004", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done" }]);
  });

  let client: AcpClient;
  await given('the adapter runs opencode with that gateway and "OPENAI_MODEL" "gpt-5.5"', async () => {
    client = await connect(sut, gateway, { env: { OPENAI_MODEL: "gpt-5.5" } });
  });

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the model gateway received only chat completions calls for the model "gpt-5.5"', async () => {
    expect(gateway.calls.map((call) => call.path)).toEqual(["/v1/chat/completions"]);
    expect(chatCalls(gateway).map((call) => call.model)).toEqual(["gpt-5.5"]);
  });
});
