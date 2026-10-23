import { scenario } from "@opensoftware/testkit";

scenario("SCN-HARNESS-011", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'the adapter ran a session in which the client refused the tool "Edit notes.md" of kind "edit"',
    async () => {
      const harness = await fakes.harness([
        { when: "fix the typo", tools: [{ title: "Edit notes.md", kind: "edit" }] },
      ]);
      const client = await sut.acp.connect(["run", "--", harness.command, ...harness.args], { approve: false });
      const session = await client.newSession();
      sessionId = session.id;
      await session.prompt("fix the typo");
    },
  );

  await when('the developer runs "transcript" with the session\'s ID', async () => {
    await sut.cli(["transcript", sessionId]);
  });

  await then('"$OUTPUT/transcript.jsonl" has the permission decision "refused" for "Edit notes.md"', async () => {
    const lines = (await sut.files.read("$OUTPUT/transcript.jsonl"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(lines.filter((line) => line.type === "permission")).toEqual([
      { type: "permission", title: "Edit notes.md", kind: "edit", decision: "refused" },
    ]);
  });
});
