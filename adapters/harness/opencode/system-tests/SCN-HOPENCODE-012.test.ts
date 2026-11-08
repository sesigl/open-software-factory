import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect } from "./opencode.ts";

scenario("SCN-HOPENCODE-012", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done" }]);
  });

  let client: AcpClient;
  await given("the adapter runs opencode with that gateway", async () => {
    client = await connect(sut, gateway);
  });

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the user\'s home has no folder ".config", ".local" or ".cache"', async () => {
    // The module's HOME is $INPUT.
    const files = await sut.files.list("$INPUT");
    expect(files.filter((file) => /^\.(config|local|cache)\//.test(file))).toEqual([]);
  });
});
