import { validate } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { exportDemo, linesOf, ranSession } from "./proxy.ts";

const RESOURCE =
  "osf.run.id=run-1,osf.work_item.id=wi-1,osf.factory.version=3f2a9c1,osf.requester.kind=person,osf.requester.id=slack:U024BE7LH,osf.source=slack";

scenario("SCN-HPROXY-007", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'serveProxy for the harness "demo" ran a session with the prompt "fix the typo" and the resource attributes "osf.run.id=run-1,osf.work_item.id=wi-1,osf.factory.version=3f2a9c1,osf.requester.kind=person,osf.requester.id=slack:U024BE7LH,osf.source=slack"',
    async () => {
      const harness = await fakes.harness([{ when: "fix the typo", reply: "done" }]);
      const resource = Object.fromEntries(RESOURCE.split(",").map((pair) => pair.split("=")));
      sessionId = await ranSession(sut, harness, "fix the typo", { resource });
    },
  );

  let written: { recordFile: string; transcriptFile: string };
  await when('the adapter exports the transcript of the session into "$OUTPUT"', async () => {
    written = exportDemo(sut, sessionId);
  });

  await then(
    '"$OUTPUT/run-record.json" is a valid "run-record" with "service.name" "harness-demo", "osf.harness.name" "demo", "osf.harness.version" "0.0.0" and "osf.outcome" "succeeded"',
    async () => {
      expect(written).toEqual({
        recordFile: sut.files.path("$OUTPUT/run-record.json"),
        transcriptFile: sut.files.path("$OUTPUT/transcript.jsonl"),
      });
      const record = JSON.parse(await sut.files.read("$OUTPUT/run-record.json"));
      expect(validate("run-record", record)).toEqual([]);
      expect(record).toEqual({
        resource: {
          "service.name": "harness-demo",
          "osf.run.id": "run-1",
          "osf.work_item.id": "wi-1",
          "osf.factory.version": "3f2a9c1",
          "osf.requester.kind": "person",
          "osf.requester.id": "slack:U024BE7LH",
          "osf.source": "slack",
          "osf.harness.name": "demo",
          "osf.harness.version": "0.0.0",
        },
        span: {
          "gen_ai.operation.name": "invoke_agent",
          "gen_ai.conversation.id": sessionId,
          "osf.outcome": "succeeded",
          "osf.transcript.uri": new URL(`file://${sut.files.path("$OUTPUT/transcript.jsonl")}`).href,
        },
      });
    },
  );

  await then(
    'its "osf.transcript.uri" is the file "$OUTPUT/transcript.jsonl", which holds the prompt "fix the typo"',
    async () => {
      const lines = await linesOf(sut, "$OUTPUT/transcript.jsonl");
      expect(lines[0]).toEqual({
        type: "session",
        sessionId,
        cwd: sut.files.path("$INPUT"),
        agent: { name: "testkit-scripted-harness", version: "0.0.0" },
        resource: expect.objectContaining({ "osf.run.id": "run-1" }),
      });
      expect(lines).toContainEqual({ type: "prompt", prompt: [{ type: "text", text: "fix the typo" }] });
      expect(lines.at(-1)).toEqual({ type: "stop", stopReason: "end_turn" });
    },
  );
});
