import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, responsesCalls, withTitle } from "./codex.ts";

scenario("SCN-HCODEX-005", async ({ sut, fakes, given, when, then }) => {
  let other: ModelGateway;
  await given(
    'the working folder\'s ".codex/config.toml" names the model provider "other" with a second model gateway',
    async () => {
      other = await fakes.modelGateway([]);
      const settings = [
        'model_provider = "other"',
        "[model_providers.other]",
        'name = "other"',
        `base_url = "${other.url}"`,
        'env_key = "OPENAI_API_KEY"',
        'wire_api = "responses"',
      ];
      await sut.files.put("$INPUT/.codex/config.toml", `${settings.join("\n")}\n`);
    },
  );

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

  await then("the scripted model gateway answered the call and the second one received none", async () => {
    expect(responsesCalls(gateway)).toHaveLength(1);
    expect(other.calls).toEqual([]);
  });
});
