import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, messagesCalls } from "./claude.ts";

scenario("SCN-HCLAUDE-004", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done" }]);
  });

  let client: AcpClient;
  await given('the adapter runs Claude Code with that gateway and "ANTHROPIC_MODEL" "claude-sonnet-5-5"', async () => {
    client = await connect(sut, gateway, { env: { ANTHROPIC_MODEL: "claude-sonnet-5-5" } });
  });

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the model gateway received a Messages API call for the model "claude-sonnet-5-5"', async () => {
    expect(messagesCalls(gateway).map((call) => call.model)).toContain("claude-sonnet-5-5");
  });
});
