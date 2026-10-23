import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, toolResult } from "./claude.ts";

scenario("SCN-HARNESS-003", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'a harness scripted to run the tool "Edit notes.md" of kind "edit" when the prompt says "fix the typo"',
    async () => {
      await sut.files.put("$INPUT/notes.md", "fixd\n");
      const file = sut.files.path("$INPUT/notes.md");
      // Claude Code edits only a file it has read in the session.
      gateway = await fakes.modelGateway([
        { when: "fix the typo", reply: "", tools: [{ name: "Read", input: { file_path: file } }] },
        {
          when: "fix the typo",
          reply: "",
          tools: [{ name: "Edit", input: { file_path: file, old_string: "fixd", new_string: "fixed" } }],
        },
        { when: "fix the typo", reply: "done" },
      ]);
    },
  );

  let client: AcpClient;
  await given('the adapter runs that harness with the allowlist "read,edit"', async () => {
    client = await connect(sut, gateway, { allow: "read,edit" });
  });

  await when('the client sends the prompt "fix the typo" and approves every tool call', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the client was asked to approve "Edit notes.md"', async () => {
    expect(client.permissionRequests().map(({ title, kind }) => ({ title, kind }))).toContainEqual({
      title: "Edit notes.md",
      kind: "edit",
    });
  });

  await then('the harness\'s tool call "Edit notes.md" was allowed', async () => {
    expect(toolResult(gateway, "toolu_2")?.is_error).not.toBe(true);
    expect(await sut.files.read("$INPUT/notes.md")).toBe("fixed\n");
  });
});
