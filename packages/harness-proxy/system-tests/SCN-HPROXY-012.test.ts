import { scenario } from "@opensoftware/testkit";
import { exportDemo, linesOf, ranSession } from "./proxy.ts";

scenario("SCN-HPROXY-012", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given('serveProxy ran a session in which the client refused "Edit notes.md" of kind "edit"', async () => {
    const harness = await fakes.harness([{ when: "fix the typo", tools: [{ title: "Edit notes.md", kind: "edit" }] }]);
    sessionId = await ranSession(sut, harness, "fix the typo", { approve: false });
  });

  await when('the adapter exports the transcript of the session into "$OUTPUT"', async () => {
    exportDemo(sut, sessionId);
  });

  await then('"$OUTPUT/transcript.jsonl" has the permission decision "refused" for "Edit notes.md"', async () => {
    const lines = await linesOf(sut, "$OUTPUT/transcript.jsonl");
    expect(lines.filter((line) => line.type === "permission")).toEqual([
      { type: "permission", title: "Edit notes.md", kind: "edit", decision: "refused" },
    ]);
  });
});
