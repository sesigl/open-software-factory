import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, responsesCalls, withTitle } from "./codex.ts";

scenario("SCN-HCODEX-004", async ({ sut, fakes, given, when, then }) => {
  await given('the working folder\'s ".codex/config.toml" names the model "gpt-folder"', async () => {
    await sut.files.put("$INPUT/.codex/config.toml", 'model = "gpt-folder"\n');
  });

  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway(withTitle([{ when: "fix the typo", reply: "done" }]));
  });

  let client: AcpClient;
  await given('the adapter runs Codex with that gateway and "OPENAI_MODEL" "gpt-5.5"', async () => {
    client = await connect(sut, gateway, { env: { OPENAI_MODEL: "gpt-5.5" } });
  });

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the model gateway received a Responses API call for the model "gpt-5.5"', async () => {
    expect(responsesCalls(gateway).map((call) => call.model)).toEqual(["gpt-5.5"]);
  });
});
