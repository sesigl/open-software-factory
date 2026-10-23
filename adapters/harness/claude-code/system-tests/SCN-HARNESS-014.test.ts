import { validate } from "@opensoftware/contracts";
import { type CliResult, scenario } from "@opensoftware/testkit";
import { connect, linesOf } from "./claude.ts";

const RESOURCE =
  "osf.run.id=run-1,osf.work_item.id=wi-1,osf.factory.version=3f2a9c1,osf.requester.kind=person,osf.requester.id=slack:U024BE7LH,osf.source=slack";

scenario("SCN-HARNESS-014", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'the adapter ran a session with the prompt "fix the typo" and the resource attributes "osf.run.id=run-1,osf.work_item.id=wi-1,osf.factory.version=3f2a9c1,osf.requester.kind=person,osf.requester.id=slack:U024BE7LH,osf.source=slack"',
    async () => {
      const gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "done" }]);
      const client = await connect(sut, gateway, { env: { OTEL_RESOURCE_ATTRIBUTES: RESOURCE } });
      const session = await client.newSession();
      sessionId = session.id;
      await session.prompt("fix the typo");
    },
  );

  let run: CliResult;
  await when('the developer runs "transcript" with the session\'s ID', async () => {
    run = await sut.cli(["transcript", sessionId]);
  });

  let record: { resource: Record<string, unknown>; span: Record<string, unknown> };
  await then(
    '"$OUTPUT/run-record.json" is a valid "run-record" with "osf.run.id" "run-1" and "osf.outcome" "succeeded"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      const written = ["run-record.json", "transcript.jsonl"].map(
        (file) => `wrote ${sut.files.path(`$OUTPUT/${file}`)}`,
      );
      expect(run.stdout).toBe(`${written.join("\n")}\n`);
      record = JSON.parse(await sut.files.read("$OUTPUT/run-record.json"));
      expect(validate("run-record", record)).toEqual([]);
      expect(record.resource["osf.run.id"]).toBe("run-1");
      expect(record.span["osf.outcome"]).toBe("succeeded");
    },
  );

  await then('its "gen_ai.conversation.id" is the session\'s ID', async () => {
    expect(record.span["gen_ai.conversation.id"]).toBe(sessionId);
  });

  await then(
    'its "osf.transcript.uri" is the file "$OUTPUT/transcript.jsonl", which holds the prompt "fix the typo"',
    async () => {
      const uri = new URL(record.span["osf.transcript.uri"] as string);
      expect(uri.protocol).toBe("file:");
      expect(decodeURIComponent(uri.pathname)).toBe(sut.files.path("$OUTPUT/transcript.jsonl"));
      const lines = await linesOf(sut, "$OUTPUT/transcript.jsonl");
      expect(lines).toContainEqual({ type: "prompt", prompt: [{ type: "text", text: "fix the typo" }] });
      // Claude Code sends updates after the turn, such as its cost, so the stop is not the last line.
      expect(lines).toContainEqual(expect.objectContaining({ type: "stop", stopReason: "end_turn" }));
    },
  );
});
