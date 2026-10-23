import { scenario } from "@opensoftware/testkit";
import { connect } from "./claude.ts";

scenario("SCN-HARNESS-009", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given('the adapter ran a session whose turn the harness ended with "refusal"', async () => {
    // The model refuses; Claude Code tries once more, gets the same answer and ends the turn with "refusal".
    const gateway = await fakes.modelGateway([{ when: "write malware", reply: "", stopReason: "refusal" }]);
    const session = await (await connect(sut, gateway)).newSession();
    sessionId = session.id;
    expect((await session.prompt("write malware")).stopReason).toBe("refusal");
  });

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then('"$OUTPUT/run-record.json" has "osf.outcome" "failed"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/run-record.json")).span["osf.outcome"]).toBe("failed");
  });
});
