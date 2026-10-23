import { type AcpTurn, scenario } from "@opensoftware/testkit";
import { connect } from "./claude.ts";

scenario("SCN-HCLAUDE-005", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  let turn: AcpTurn;
  await given(
    'the adapter ran a session in which the model gateway ended its answer to "write malware" with the stop reason "refusal"',
    async () => {
      // The model refuses; Claude Code tries once more, gets the same answer and ends the turn with "refusal".
      const gateway = await fakes.modelGateway([{ when: "write malware", reply: "", stopReason: "refusal" }]);
      const session = await (await connect(sut, gateway)).newSession();
      sessionId = session.id;
      turn = await session.prompt("write malware");
    },
  );

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then('the turn ended with "refusal" and "$OUTPUT/run-record.json" has "osf.outcome" "failed"', async () => {
    expect(turn.stopReason).toBe("refusal");
    expect(JSON.parse(await sut.files.read("$OUTPUT/run-record.json")).span["osf.outcome"]).toBe("failed");
  });
});
