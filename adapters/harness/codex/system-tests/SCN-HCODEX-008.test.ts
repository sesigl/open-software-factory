import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, withTitle } from "./codex.ts";

scenario("SCN-HCODEX-008", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway(withTitle([{ when: "fix the typo", reply: "done" }]));
  });

  let client: AcpClient;
  await given("the adapter runs Codex with that gateway", async () => {
    client = await connect(sut, gateway);
  });

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the Responses API call\'s turn metadata says "analytics_enabled" false', async () => {
    const call = gateway.calls.find(
      (each) => each.path.startsWith("/v1/responses") && each.body.includes("fix the typo"),
    );
    const body = JSON.parse(call?.body ?? "{}") as { client_metadata?: Record<string, string> };
    const metadata = JSON.parse(body.client_metadata?.["x-codex-turn-metadata"] ?? "{}") as Record<string, unknown>;
    expect(metadata.analytics_enabled).toBe(false);
  });
});
