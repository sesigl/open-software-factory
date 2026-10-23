import { scenario } from "@opensoftware/testkit";

scenario("SCN-HARNESS-010", async ({ sut, fakes, given, when, then }) => {
  let sessionId = "";
  await given(
    'the adapter with the allowlist "read,edit" refused the tool "rm -rf build" of kind "execute" in a session',
    async () => {
      const harness = await fakes.harness([{ when: "clean up", tools: [{ title: "rm -rf build", kind: "execute" }] }]);
      const client = await sut.acp.connect(["run", "--allow", "read,edit", "--", harness.command, ...harness.args]);
      const session = await client.newSession();
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
      const lines = (await sut.files.read("$OUTPUT/transcript.jsonl"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(lines.filter((line) => line.type === "permission")).toEqual([
        { type: "permission", title: "rm -rf build", kind: "execute", decision: "refused by the allowlist" },
      ]);
    },
  );
});
