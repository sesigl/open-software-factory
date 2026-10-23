import { scenario } from "@opensoftware/testkit";
import { connect } from "./opencode.ts";

scenario("SCN-HOPENCODE-001", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given('the adapter ran a session in which the model gateway answered "fix the typo" with "done"', async () => {
    const gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done" }]);
    const client = await connect(sut, gateway);
    expect(client.agent).toEqual({ name: "OpenCode", version: "1.19.4" });
    const session = await client.newSession();
    sessionId = session.id;
    await session.prompt("fix the typo");
  });

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then(
    '"$OUTPUT/run-record.json" has "service.name" "harness-opencode", "osf.harness.name" "opencode" and "osf.harness.version" "1.19.4"',
    async () => {
      const { resource } = JSON.parse(await sut.files.read("$OUTPUT/run-record.json"));
      expect(resource["service.name"]).toBe("harness-opencode");
      expect(resource["osf.harness.name"]).toBe("opencode");
      expect(resource["osf.harness.version"]).toBe("1.19.4");
    },
  );
});
