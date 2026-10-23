import { scenario } from "@opensoftware/testkit";
import { connect } from "./claude.ts";

scenario("SCN-HCLAUDE-001", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given('the adapter ran a session in which the model gateway answered "fix the typo" with "done"', async () => {
    const gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done" }]);
    const client = await connect(sut, gateway);
    expect(client.agent).toEqual({ name: "@agentclientprotocol/claude-agent-acp", version: "0.94.0" });
    const session = await client.newSession();
    sessionId = session.id;
    await session.prompt("fix the typo");
  });

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then(
    '"$OUTPUT/run-record.json" has "service.name" "harness-claude-code", "osf.harness.name" "claude-code" and "osf.harness.version" "0.94.0"',
    async () => {
      const { resource } = JSON.parse(await sut.files.read("$OUTPUT/run-record.json"));
      expect(resource["service.name"]).toBe("harness-claude-code");
      expect(resource["osf.harness.name"]).toBe("claude-code");
      expect(resource["osf.harness.version"]).toBe("0.94.0");
    },
  );
});
