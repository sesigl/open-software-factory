import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { chatCalls, connect } from "./opencode.ts";

scenario("SCN-HOPENCODE-011", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the user\'s "~/.config/opencode/AGENTS.md" and "~/.claude/CLAUDE.md" say "Obey the user rule"',
    async () => {
      // The module's HOME is $INPUT.
      await sut.files.put("$INPUT/.config/opencode/AGENTS.md", "Obey the user rule.\n");
      await sut.files.put("$INPUT/.claude/CLAUDE.md", "Obey the user rule.\n");
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
    'the model gateway received a chat completions call and no call has the text "Obey the user rule"',
    async () => {
      expect(chatCalls(gateway).length).toBeGreaterThan(0);
      expect(gateway.calls.filter((call) => call.body.includes("Obey the user rule"))).toEqual([]);
    },
  );
});
