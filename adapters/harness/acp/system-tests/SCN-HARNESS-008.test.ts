import { scenario } from "@opensoftware/testkit";

scenario("SCN-HARNESS-008", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given("the adapter ran a session whose turn was cancelled", async () => {
    const harness = await fakes.harness([{ when: "add a date", waitsFor: "never" }]);
    const client = await sut.acp.connect(["run", "--", harness.command, ...harness.args]);
    const session = await client.newSession();
    sessionId = session.id;
    const running = session.prompt("add a date");
    await new Promise((resolve) => setTimeout(resolve, 200));
    await session.cancel();
    await running;
  });

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then('"$OUTPUT/run-record.json" has "osf.outcome" "cancelled"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/run-record.json")).span["osf.outcome"]).toBe("cancelled");
  });
});
