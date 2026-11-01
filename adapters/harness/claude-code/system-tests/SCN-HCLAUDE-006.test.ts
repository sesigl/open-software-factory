import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, messagesCalls } from "./claude.ts";

scenario("SCN-HCLAUDE-006", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done" }]);
  });

  let client: AcpClient;
  await given('the adapter runs Claude Code with that gateway and "OSF_EFFORT" "low"', async () => {
    client = await connect(sut, gateway, { env: { OSF_EFFORT: "low" } });
  });

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the model gateway received a Messages API call with the effort "low"', async () => {
    expect(messagesCalls(gateway).map((call) => call.output_config?.effort)).toContain("low");
  });
});
