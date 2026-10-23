import { scenario } from "@opensoftware/testkit";
import { connect, linesOf } from "./opencode.ts";

scenario("SCN-HARNESS-010", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'the adapter with the allowlist "read,edit" refused the tool "rm -rf build" of kind "execute" in a session',
    async () => {
      const bash = { name: "bash", input: { command: "rm -rf build", description: "Remove the build folder" } };
      const gateway = await fakes.modelGateway([
        { when: "clean up", reply: "", tools: [bash] },
        { when: "clean up", reply: "I could not remove it." },
      ]);
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
      const lines = await linesOf(sut, "$OUTPUT/transcript.jsonl");
      expect(lines.filter((line) => line.type === "permission")).toEqual([
        { type: "permission", title: "rm -rf build", kind: "execute", decision: "refused by the allowlist" },
      ]);
    },
  );
});
