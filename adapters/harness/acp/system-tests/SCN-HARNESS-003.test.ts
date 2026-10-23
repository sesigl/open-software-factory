import { type AcpClient, type Harness, scenario } from "@opensoftware/testkit";

scenario("SCN-HARNESS-003", async ({ sut, fakes, given, when, then }) => {
  let harness: Harness;
  await given(
    'a harness scripted to run the tool "Edit notes.md" of kind "edit" when the prompt says "fix the typo"',
    async () => {
      harness = await fakes.harness([{ when: "fix the typo", tools: [{ title: "Edit notes.md", kind: "edit" }] }]);
    },
  );

  let client: AcpClient;
  await given('the adapter runs that harness with the allowlist "read,edit"', async () => {
    client = await sut.acp.connect(["run", "--allow", "read,edit", "--", harness.command, ...harness.args], {
      approve: true,
    });
  });

  await when('the client sends the prompt "fix the typo" and approves every tool call', async () => {
    await (await client.newSession()).prompt("fix the typo");
  });

  await then('the client was asked to approve "Edit notes.md"', async () => {
    expect(client.permissionRequests().map((request) => [request.title, request.kind])).toEqual([
      ["Edit notes.md", "edit"],
    ]);
  });

  await then('the harness\'s tool call "Edit notes.md" was allowed', async () => {
    expect(harness.toolCalls()).toEqual([{ title: "Edit notes.md", kind: "edit", outcome: "allowed" }]);
  });
});
