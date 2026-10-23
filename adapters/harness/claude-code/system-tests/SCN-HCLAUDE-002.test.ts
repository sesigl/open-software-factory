import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect } from "./claude.ts";

scenario("SCN-HCLAUDE-002", async ({ sut, fakes, given, when, then }) => {
  await given('"$INPUT/.claude/settings.json" sets the default mode "bypassPermissions"', async () => {
    await sut.files.put(
      "$INPUT/.claude/settings.json",
      JSON.stringify({ permissions: { defaultMode: "acceptEdits" } }),
    );
  });

  let gateway: ModelGateway;
  await given(
    'a model gateway scripted to write "fixed" to "notes.md" when the prompt says "fix the typo"',
    async () => {
      const write = { name: "Write", input: { file_path: sut.files.path("$INPUT/app/notes.md"), content: "fixed\n" } };
      gateway = await fakes.modelGateway([
        { when: "fix the typo", reply: "", tools: [write] },
        { when: "fix the typo", reply: "done" },
      ]);
    },
  );

  let client: AcpClient;
  await given("the adapter runs Claude Code with that gateway", async () => {
    client = await connect(sut, gateway);
  });

  await when(
    'the client sends the prompt "fix the typo" in a session in "$INPUT/app" and approves every tool call',
    async () => {
      await (await client.newSession("$INPUT/app")).prompt("fix the typo");
    },
  );

  await then('the client was asked to approve "Write notes.md"', async () => {
    expect(client.permissionRequests().map(({ title, kind }) => ({ title, kind }))).toEqual([
      { title: "Write notes.md", kind: "edit" },
    ]);
    expect(await sut.files.read("$INPUT/app/notes.md")).toBe("fixed\n");
  });
});
