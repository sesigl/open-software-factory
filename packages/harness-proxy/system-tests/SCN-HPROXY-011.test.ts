import { scenario } from "@opensoftware/testkit";
import { exportDemo, linesOf, ranSession } from "./proxy.ts";

scenario("SCN-HPROXY-011", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'serveProxy with the allowlist "read,edit" ran a session in which the client approved "Edit notes.md" of kind "edit" and the allowlist refused "rm -rf build" of kind "execute"',
    async () => {
      const tools = [
        { title: "Edit notes.md", kind: "edit" as const },
        { title: "rm -rf build", kind: "execute" as const },
      ];
      const harness = await fakes.harness([{ when: "clean up", tools }]);
      sessionId = await ranSession(sut, harness, "clean up", { allow: ["read", "edit"] });
    },
  );

  await when('the adapter exports the transcript of the session into "$OUTPUT"', async () => {
    exportDemo(sut, sessionId);
  });

  await then(
    '"$OUTPUT/transcript.jsonl" has the permission decisions "allowed" for "Edit notes.md" and "refused by the allowlist" for "rm -rf build"',
    async () => {
      const lines = await linesOf(sut, "$OUTPUT/transcript.jsonl");
      expect(lines.filter((line) => line.type === "permission")).toEqual([
        { type: "permission", title: "Edit notes.md", kind: "edit", decision: "allowed" },
        { type: "permission", title: "rm -rf build", kind: "execute", decision: "refused by the allowlist" },
      ]);
    },
  );
});
