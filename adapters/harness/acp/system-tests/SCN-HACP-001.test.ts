import { scenario } from "@opensoftware/testkit";

scenario("SCN-HACP-001", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given('the adapter ran a session of a harness whose ACP agent has the version "0.0.0"', async () => {
    const harness = await fakes.harness([{ when: "fix the typo", reply: "done" }]);
    const client = await sut.acp.connect(["run", "--", harness.command, ...harness.args]);
    expect(client.agent.version).toBe("0.0.0");
    const session = await client.newSession();
    sessionId = session.id;
    await session.prompt("fix the typo");
  });

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then(
    '"$OUTPUT/run-record.json" has "service.name" "harness-acp", "osf.harness.name" "acp" and "osf.harness.version" "0.0.0"',
    async () => {
      const { resource } = JSON.parse(await sut.files.read("$OUTPUT/run-record.json"));
      expect(resource["service.name"]).toBe("harness-acp");
      expect(resource["osf.harness.name"]).toBe("acp");
      expect(resource["osf.harness.version"]).toBe("0.0.0");
    },
  );
});
