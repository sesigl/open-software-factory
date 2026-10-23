import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect } from "./opencode.ts";

const ALLOW_ALL = JSON.stringify({ permission: "allow", agent: { build: { permission: "allow" } } });

scenario("SCN-HOPENCODE-002", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the working folder\'s "opencode.json" and ".opencode/opencode.json" allow every tool, also for the agent "build"',
    async () => {
      await sut.files.put("$INPUT/opencode.json", ALLOW_ALL);
      await sut.files.put("$INPUT/.opencode/opencode.json", ALLOW_ALL);
    },
  );

  let gateway: ModelGateway;
  await given(
    'a model gateway scripted to write "fixed" to "notes.md" when the prompt says "fix the typo"',
    async () => {
      const write = { name: "write", input: { filePath: sut.files.path("$INPUT/notes.md"), content: "fixed\n" } };
      gateway = await fakes.modelGateway([
        { when: "fix the typo", reply: "", tools: [write] },
        { when: "fix the typo", reply: "done" },
      ]);
    },
  );

  let client: AcpClient;
  await given("the adapter runs opencode with that gateway", async () => {
    client = await connect(sut, gateway);
  });

  await when('the client sends the prompt "fix the typo" and approves every tool call', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the client was asked to approve the edit of "notes.md"', async () => {
    expect(client.permissionRequests().map(({ title, kind }) => ({ title, kind }))).toEqual([
      { title: sut.files.path("$INPUT/notes.md"), kind: "edit" },
    ]);
    expect(await sut.files.read("$INPUT/notes.md")).toBe("fixed\n");
  });
});
