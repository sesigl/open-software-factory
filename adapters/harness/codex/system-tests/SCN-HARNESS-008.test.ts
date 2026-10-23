import { scenario } from "@opensoftware/testkit";
import { connect, responsesCalls, until } from "./codex.ts";

scenario("SCN-HARNESS-008", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given("the adapter ran a session whose turn was cancelled", async () => {
    const gateway = await fakes.modelGateway([{ when: "add a date", reply: "", hangs: true }]);
    const session = await (await connect(sut, gateway)).newSession();
    sessionId = session.id;
    const running = session.prompt("add a date");
    await until(() => responsesCalls(gateway).length > 0);
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
