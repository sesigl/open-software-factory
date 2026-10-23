import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, toolOutput, withTitle } from "./codex.ts";

scenario("SCN-HCODEX-002", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'a model gateway scripted to run the command "touch made.txt" when the prompt says "make a file"',
    async () => {
      gateway = await fakes.modelGateway(
        withTitle([
          { when: "make a file", reply: "", tools: [{ name: "exec_command", input: { cmd: "touch made.txt" } }] },
          { when: "make a file", reply: "I could not make it." },
        ]),
      );
    },
  );

  let client: AcpClient;
  await given("the adapter runs Codex with that gateway", async () => {
    client = await connect(sut, gateway);
  });

  await when('the client sends the prompt "make a file" and approves every tool call', async () => {
    await (await client.newSession()).prompt("make a file");
  });

  await then("the client was not asked to approve a tool call", async () => {
    expect(client.permissionRequests()).toEqual([]);
  });

  await then('Codex sent the model a failed command and "$INPUT/made.txt" does not exist', async () => {
    expect(toolOutput(gateway, "call_1")).toMatch(/Process exited with code [1-9]/);
    await expect(sut.files.read("$INPUT/made.txt")).rejects.toThrow();
  });
});
