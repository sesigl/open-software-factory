import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, responsesCalls, withTitle } from "./codex.ts";

scenario("SCN-HCODEX-009", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway(withTitle([{ when: "fix the typo", reply: "done" }]));
  });

  let client: AcpClient;
  await given('the adapter runs Codex with that gateway, "OPENAI_MODEL" "gpt-5.5" and "OSF_EFFORT" "low"', async () => {
    client = await connect(sut, gateway, { env: { OPENAI_MODEL: "gpt-5.5", OSF_EFFORT: "low" } });
  });

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the model gateway received a Responses API call with the reasoning effort "low"', async () => {
    expect(responsesCalls(gateway).map((call) => call.reasoning?.effort)).toEqual(["low"]);
  });
});
