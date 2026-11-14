import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, responsesCalls, withTitle } from "./codex.ts";

scenario("SCN-HCODEX-012", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a model gateway scripted to reply "done" when the prompt says "fix the typo"', async () => {
    gateway = await fakes.modelGateway(withTitle([{ when: "fix the typo", reply: "done" }]));
  });

  let client: AcpClient;
  await given(
    'the adapter runs Codex with that gateway and "OPENAI_MODEL" "deepseek/deepseek-v4.1-flash-1017"',
    async () => {
      client = await connect(sut, gateway, { env: { OPENAI_MODEL: "deepseek/deepseek-v4.1-flash-1017" } });
    },
  );

  await when('the client sends the prompt "fix the typo"', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then(
    'the Responses API call for the model "deepseek/deepseek-v4.1-flash-1017" offers the tool "apply_patch"',
    async () => {
      const [call] = responsesCalls(gateway);
      expect(call?.model).toBe("deepseek/deepseek-v4.1-flash-1017");
      expect(call?.tools).toContainEqual(expect.objectContaining({ name: "apply_patch" }));
    },
  );
});
