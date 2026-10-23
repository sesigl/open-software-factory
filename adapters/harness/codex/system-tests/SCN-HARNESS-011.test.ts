import { scenario } from "@opensoftware/testkit";
import { connect, linesOf, patch, withTitle } from "./codex.ts";

scenario("SCN-HARNESS-011", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'the adapter ran a session in which the client refused the tool "Edit notes.md" of kind "edit"',
    async () => {
      await sut.files.put("$INPUT/notes.md", "fixd\n");
      const gateway = await fakes.modelGateway(
        withTitle([
          {
            when: "fix the typo",
            reply: "",
            tools: [{ name: "apply_patch", input: patch("notes.md", "fixd", "fixed") }],
          },
          { when: "fix the typo", reply: "done" },
        ]),
      );
      const session = await (await connect(sut, gateway, { approve: false })).newSession();
      sessionId = session.id;
      await session.prompt("fix the typo");
    },
  );

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then('"$OUTPUT/transcript.jsonl" has the permission decision "refused" for "Edit notes.md"', async () => {
    // Codex names an edit "Edit files"; the file is in the tool call's updates.
    const lines = await linesOf(sut, "$OUTPUT/transcript.jsonl");
    expect(lines.filter((line) => line.type === "permission")).toEqual([
      { type: "permission", title: "Edit files", kind: "edit", decision: "refused" },
    ]);
    expect(JSON.stringify(lines)).toContain("notes.md");
  });
});
