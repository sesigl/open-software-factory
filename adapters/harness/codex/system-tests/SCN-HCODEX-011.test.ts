import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, withTitle } from "./codex.ts";

scenario("SCN-HCODEX-011", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway(withTitle([{ when: "fix the typo", reply: "done" }]));
  });

  let client: AcpClient;
  await given('the adapter runs Codex with that gateway and "OPENAI_API_KEY" "testkit-other-key"', async () => {
    // The gateway takes any key; this one is no credential.
    client = await connect(sut, gateway, { env: { OPENAI_API_KEY: "testkit-other-key" } });
  });

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the Responses API call has the header "authorization" "Bearer testkit-other-key"', async () => {
    const call = gateway.calls.find(
      (each) => each.path.startsWith("/v1/responses") && each.body.includes("fix the typo"),
    );
    expect(call?.headers.authorization).toBe("Bearer testkit-other-key");
  });
});
