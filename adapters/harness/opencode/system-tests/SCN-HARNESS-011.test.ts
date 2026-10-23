import { scenario } from "@opensoftware/testkit";
import { connect, linesOf } from "./opencode.ts";

scenario("SCN-HARNESS-011", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'the adapter ran a session in which the client refused the tool "Edit notes.md" of kind "edit"',
    async () => {
      await sut.files.put("$INPUT/notes.md", "fixd\n");
      const file = sut.files.path("$INPUT/notes.md");
      const gateway = await fakes.modelGateway([
        { when: "fix the typo", reply: "", tools: [{ name: "read", input: { filePath: file } }] },
        {
          when: "fix the typo",
          reply: "",
          tools: [{ name: "edit", input: { filePath: file, oldString: "fixd", newString: "fixed" } }],
        },
        { when: "fix the typo", reply: "done" },
      ]);
      const session = await (await connect(sut, gateway, { approve: false })).newSession();
      sessionId = session.id;
      await session.prompt("fix the typo");
    },
  );

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then('"$OUTPUT/transcript.jsonl" has the permission decision "refused" for "Edit notes.md"', async () => {
    // opencode names an edit by the path of its file.
    const lines = await linesOf(sut, "$OUTPUT/transcript.jsonl");
    expect(lines.filter((line) => line.type === "permission")).toEqual([
      { type: "permission", title: sut.files.path("$INPUT/notes.md"), kind: "edit", decision: "refused" },
    ]);
  });
});
