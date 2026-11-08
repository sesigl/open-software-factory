import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect } from "./opencode.ts";

scenario("SCN-HOPENCODE-010", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done" }]);
  });

  let client: AcpClient;
  await given('the adapter runs opencode with that gateway and "OPENAI_API_KEY" "testkit-other-key"', async () => {
    // The gateway takes any key; this one is no credential.
    client = await connect(sut, gateway, { env: { OPENAI_API_KEY: "testkit-other-key" } });
  });

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('every chat completions call has the header "authorization" "Bearer testkit-other-key"', async () => {
    const calls = gateway.calls.filter((call) => call.path.startsWith("/v1/chat/completions"));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.map((call) => call.headers.authorization)).toEqual(calls.map(() => "Bearer testkit-other-key"));
  });
});
