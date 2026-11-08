import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { chatCalls, connect } from "./opencode.ts";

const SKILL = "---\nname: folder-skill\ndescription: Use the folder skill.\n---\nThe folder skill.\n";

scenario("SCN-HOPENCODE-013", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the working folder\'s "opencode.json" names the instructions file "extra.md", which says "Obey the folder rule"',
    async () => {
      await sut.files.put("$INPUT/opencode.json", JSON.stringify({ instructions: ["extra.md"] }));
      await sut.files.put("$INPUT/extra.md", "Obey the folder rule.\n");
    },
  );

  await given(
    'the working folder has the skill ".agents/skills/folder-skill" with the description "Use the folder skill"',
    async () => {
      await sut.files.put("$INPUT/.agents/skills/folder-skill/SKILL.md", SKILL);
    },
  );

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

  await then(
    'the model gateway received a chat completions call and no call has the text "Obey the folder rule" or "Use the folder skill"',
    async () => {
      expect(chatCalls(gateway).length).toBeGreaterThan(0);
      const leaked = gateway.calls.filter(
        (call) => call.body.includes("Obey the folder rule") || call.body.includes("Use the folder skill"),
      );
      expect(leaked).toEqual([]);
    },
  );
});
