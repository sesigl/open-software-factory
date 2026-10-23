import { scenario } from "@opensoftware/testkit";
import { connect, withTitle } from "./codex.ts";

scenario("SCN-HCODEX-001", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given('the adapter ran a session in which the model gateway answered "fix the typo" with "done"', async () => {
    const gateway = await fakes.modelGateway(withTitle([{ when: "fix the typo", reply: "done" }]));
    const client = await connect(sut, gateway);
    expect(client.agent).toEqual({ name: "@agentclientprotocol/codex-acp", version: "2.2.2" });
    const session = await client.newSession();
    sessionId = session.id;
    await session.prompt("fix the typo");
  });

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then(
    '"$OUTPUT/run-record.json" has "service.name" "harness-codex", "osf.harness.name" "codex" and "osf.harness.version" "2.2.2"',
    async () => {
      const { resource } = JSON.parse(await sut.files.read("$OUTPUT/run-record.json"));
      expect(resource["service.name"]).toBe("harness-codex");
      expect(resource["osf.harness.name"]).toBe("codex");
      expect(resource["osf.harness.version"]).toBe("2.2.2");
    },
  );
});
