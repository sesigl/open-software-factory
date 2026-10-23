import { scenario } from "@opensoftware/testkit";
import { connect, linesOf, withTitle } from "./codex.ts";

scenario("SCN-HARNESS-010", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'the adapter with the allowlist "read,edit" refused the tool "rm -rf build" of kind "execute" in a session',
    async () => {
      const rm = {
        name: "exec_command",
        input: {
          cmd: "rm -rf build",
          sandbox_permissions: "require_escalated",
          justification: "Remove the build folder",
        },
      };
      const gateway = await fakes.modelGateway(withTitle([{ when: "clean up", reply: "", tools: [rm] }]));
      const session = await (await connect(sut, gateway, { allow: "read,edit" })).newSession();
      sessionId = session.id;
      await session.prompt("clean up");
    },
  );

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then(
    '"$OUTPUT/transcript.jsonl" has the permission decision "refused by the allowlist" for "rm -rf build"',
    async () => {
      // Codex names a command "Run command" and gives the command line in the tool call's input.
      const lines = await linesOf(sut, "$OUTPUT/transcript.jsonl");
      expect(lines.filter((line) => line.type === "permission")).toEqual([
        { type: "permission", title: "Run command", kind: "execute", decision: "refused by the allowlist" },
      ]);
      expect(JSON.stringify(lines)).toContain('"command":"rm -rf build"');
    },
  );
});
