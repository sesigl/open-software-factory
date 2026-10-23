import { scenario } from "@opensoftware/testkit";
import { connect, linesOf } from "./claude.ts";

scenario("SCN-HARNESS-011", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'the adapter ran a session in which the client refused the tool "Edit notes.md" of kind "edit"',
    async () => {
      await sut.files.put("$INPUT/notes.md", "fixd\n");
      const file = sut.files.path("$INPUT/notes.md");
      const gateway = await fakes.modelGateway([
        { when: "fix the typo", reply: "", tools: [{ name: "Read", input: { file_path: file } }] },
        {
          when: "fix the typo",
          reply: "",
          tools: [{ name: "Edit", input: { file_path: file, old_string: "fixd", new_string: "fixed" } }],
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
    const lines = await linesOf(sut, "$OUTPUT/transcript.jsonl");
    expect(lines.filter((line) => line.type === "permission")).toEqual([
      { type: "permission", title: "Edit notes.md", kind: "edit", decision: "refused" },
    ]);
  });
});
