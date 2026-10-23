import { type AcpClient, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, toolResult } from "./claude.ts";

scenario("SCN-HARNESS-002", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'a harness scripted to run the tool "rm -rf build" of kind "execute" when the prompt says "clean up"',
    async () => {
      await sut.files.put("$INPUT/build/app.js", "built\n");
      const bash = { name: "Bash", input: { command: "rm -rf build", description: "Remove the build folder" } };
      gateway = await fakes.modelGateway([
        { when: "clean up", reply: "", tools: [bash] },
        { when: "clean up", reply: "I could not remove it." },
      ]);
    },
  );

  let client: AcpClient;
  await given('the adapter runs that harness with the allowlist "read,edit"', async () => {
    client = await connect(sut, gateway, { allow: "read,edit" });
  });

  await when('the client sends the prompt "clean up"', async () => {
    await (await client.newSession()).prompt("clean up");
  });

  await then('the harness\'s tool call "rm -rf build" was refused', async () => {
    expect(toolResult(gateway, "toolu_1")).toMatchObject({ is_error: true });
    expect(await sut.files.read("$INPUT/build/app.js")).toBe("built\n");
  });

  await then("the client was not asked to approve a tool call", async () => {
    expect(client.permissionRequests()).toEqual([]);
  });
});
