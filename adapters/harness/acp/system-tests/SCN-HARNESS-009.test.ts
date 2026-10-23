import { scenario } from "@opensoftware/testkit";

scenario("SCN-HARNESS-009", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given('the adapter ran a session whose turn the harness ended with "refusal"', async () => {
    const harness = await fakes.harness([{ when: "delete the tests", stopReason: "refusal" }]);
    const client = await sut.acp.connect(["run", "--", harness.command, ...harness.args]);
    const session = await client.newSession();
    sessionId = session.id;
    await session.prompt("delete the tests");
  });

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then('"$OUTPUT/run-record.json" has "osf.outcome" "failed"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/run-record.json")).span["osf.outcome"]).toBe("failed");
  });
});
