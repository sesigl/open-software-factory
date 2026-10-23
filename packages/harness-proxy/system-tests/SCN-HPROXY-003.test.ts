import { type AcpClient, type Harness, scenario } from "@opensoftware/testkit";
import { serve } from "./proxy.ts";

scenario("SCN-HPROXY-003", async ({ sut, fakes, given, when, then }) => {
  let harness: Harness;
  await given(
    'a harness scripted to run the tool "rm -rf build" of kind "execute" when the prompt says "clean up"',
    async () => {
      harness = await fakes.harness([{ when: "clean up", tools: [{ title: "rm -rf build", kind: "execute" }] }]);
    },
  );

  let client: AcpClient;
  await given("serveProxy runs that harness without an allowlist", async () => {
    client = await serve(sut, harness);
  });

  await when('the client sends the prompt "clean up" and approves every tool call', async () => {
    await (await client.newSession()).prompt("clean up");
  });

  await then('the client was asked to approve "rm -rf build"', async () => {
    expect(client.permissionRequests()).toEqual([
      { sessionId: expect.any(String), title: "rm -rf build", kind: "execute" },
    ]);
  });

  await then('the harness\'s tool call "rm -rf build" was allowed', async () => {
    expect(harness.toolCalls()).toEqual([{ title: "rm -rf build", kind: "execute", outcome: "allowed" }]);
  });
});
