import { type AcpClient, type AcpTurn, type ModelGateway, scenario } from "@opensoftware/testkit";
import { chatCalls, connect } from "./opencode.ts";

scenario("SCN-HARNESS-002", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'a harness scripted to run the tool "rm -rf build" of kind "execute" when the prompt says "clean up"',
    async () => {
      await sut.files.put("$INPUT/build/app.js", "built\n");
      const bash = { name: "bash", input: { command: "rm -rf build", description: "Remove the build folder" } };
      gateway = await fakes.modelGateway([{ when: "clean up", reply: "", tools: [bash] }]);
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
    // opencode ends the turn at a refused tool call, so the model gets no result of it.
    expect(turn.stopReason).toBe("end_turn");
    expect(chatCalls(gateway)).toHaveLength(1);
    expect(await sut.files.read("$INPUT/build/app.js")).toBe("built\n");
  });

  await then("the client was not asked to approve a tool call", async () => {
    expect(client.permissionRequests()).toEqual([]);
  });
});
