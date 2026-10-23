import { type AcpClient, type Harness, scenario } from "@opensoftware/testkit";
import { serve } from "./proxy.ts";

scenario("SCN-HPROXY-002", async ({ sut, fakes, given, when, then }) => {
  let harness: Harness;
  await given(
    'a harness scripted to run the tool "rm -rf build" of kind "execute" when the prompt says "clean up"',
    async () => {
      harness = await fakes.harness([{ when: "clean up", tools: [{ title: "rm -rf build", kind: "execute" }] }]);
    },
  );

  let client: AcpClient;
  await given('serveProxy runs that harness with the allowlist "read,edit"', async () => {
    client = await serve(sut, harness, { allow: ["read", "edit"] });
  });

  await when('the client sends the prompt "clean up"', async () => {
    await (await client.newSession()).prompt("clean up");
  });

  await then('the harness\'s tool call "rm -rf build" was refused', async () => {
    expect(harness.toolCalls()).toEqual([{ title: "rm -rf build", kind: "execute", outcome: "refused" }]);
  });

  await then("the client was not asked to approve a tool call", async () => {
    expect(client.permissionRequests()).toEqual([]);
  });
});
