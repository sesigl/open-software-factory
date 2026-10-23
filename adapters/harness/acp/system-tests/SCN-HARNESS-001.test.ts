import { type AcpClient, type AcpTurn, type Harness, scenario } from "@opensoftware/testkit";

scenario("SCN-HARNESS-001", async ({ sut, fakes, given, when, then }) => {
  let harness: Harness;
  await given(
    'a harness scripted to write "fixed" to "notes.md" and reply "done" when the prompt says "fix the typo"',
    async () => {
      harness = await fakes.harness([{ when: "fix the typo", edits: { "notes.md": "fixed\n" }, reply: "done" }]);
    },
  );

  let client: AcpClient;
  await given("the adapter runs that harness", async () => {
    client = await sut.acp.connect(["run", "--", harness.command, ...harness.args]);
  });

  let turn: AcpTurn;
  await when('the client starts a session in "$INPUT/app" and sends the prompt "fix the typo"', async () => {
    const session = await client.newSession("$INPUT/app");
    turn = await session.prompt("fix the typo");
  });

  await then('the turn ends with "end_turn" and the reply "done"', async () => {
    expect(turn).toEqual({ stopReason: "end_turn", reply: "done" });
  });

  await then('"$INPUT/app/notes.md" says "fixed"', async () => {
    expect(await sut.files.read("$INPUT/app/notes.md")).toBe("fixed\n");
  });
});
