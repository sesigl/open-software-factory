import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, patch, toolOutput, withTitle } from "./codex.ts";

scenario("SCN-HARNESS-003", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'a harness scripted to run the tool "Edit notes.md" of kind "edit" when the prompt says "fix the typo"',
    async () => {
      await sut.files.put("$INPUT/notes.md", "fixd\n");
      gateway = await fakes.modelGateway(
        withTitle([
          {
            when: "fix the typo",
            reply: "",
            tools: [{ name: "apply_patch", input: patch("notes.md", "fixd", "fixed") }],
          },
          { when: "fix the typo", reply: "done" },
        ]),
      );
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
    // Codex names an edit "Edit files" and gives the file as its location.
    const asked = client.permissionRequests().map(({ title, kind }) => ({ title, kind }));
    expect(asked).toEqual([{ title: "Edit files", kind: "edit" }]);
  });

  await then('the harness\'s tool call "Edit notes.md" was allowed', async () => {
    expect(toolOutput(gateway, "call_1")).toContain("Success");
    expect(await sut.files.read("$INPUT/notes.md")).toBe("fixed\n");
  });
});
