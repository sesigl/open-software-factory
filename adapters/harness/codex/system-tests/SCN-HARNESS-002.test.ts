import { type AcpClient, type AcpTurn, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, responsesCalls, withTitle } from "./codex.ts";

/** In the mode read-only, a command that writes asks to leave the sandbox, and Codex asks before it runs one. */
const RM = {
  name: "exec_command",
  input: { cmd: "rm -rf build", sandbox_permissions: "require_escalated", justification: "Remove the build folder" },
};

scenario("SCN-HARNESS-002", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'a harness scripted to run the tool "rm -rf build" of kind "execute" when the prompt says "clean up"',
    async () => {
      await sut.files.put("$INPUT/build/app.js", "built\n");
      gateway = await fakes.modelGateway(withTitle([{ when: "clean up", reply: "", tools: [RM] }]));
    },
  );

  let client: AcpClient;
  await given('the adapter runs that harness with the allowlist "read,edit"', async () => {
    client = await connect(sut, gateway, { allow: "read,edit" });
  });

  let turn: AcpTurn;
  await when('the client sends the prompt "clean up"', async () => {
    turn = await (await client.newSession()).prompt("clean up");
  });

  await then('the harness\'s tool call "rm -rf build" was refused', async () => {
    // Codex ends the turn with "cancelled" at a refused tool call, so the model gets no output of it.
    expect(turn.stopReason).toBe("cancelled");
    expect(responsesCalls(gateway)).toHaveLength(1);
    expect(await sut.files.read("$INPUT/build/app.js")).toBe("built\n");
  });

  await then("the client was not asked to approve a tool call", async () => {
    expect(client.permissionRequests()).toEqual([]);
  });
});
