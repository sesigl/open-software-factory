import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, responsesCalls, withTitle } from "./codex.ts";

scenario("SCN-HCODEX-010", async ({ sut, fakes, given, when, then }) => {
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

  await then(
    'the Responses API call offers the tools "exec_command" and "apply_patch" and no tool "web_search"',
    async () => {
      const [call] = responsesCalls(gateway);
      const names = (call?.tools ?? []).map((tool) => tool.name ?? tool.type);
      expect(names).toEqual(expect.arrayContaining(["exec_command", "apply_patch"]));
      expect(names).not.toContain("web_search");
    },
  );
});
