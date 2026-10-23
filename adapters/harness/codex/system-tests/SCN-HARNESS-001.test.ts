import { type AcpClient, type AcpTurn, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, withTitle } from "./codex.ts";

scenario("SCN-HARNESS-001", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'a harness scripted to write "fixed" to "notes.md" and reply "done" when the prompt says "fix the typo"',
    async () => {
      const add = { name: "apply_patch", input: "*** Begin Patch\n*** Add File: notes.md\n+fixed\n*** End Patch\n" };
      gateway = await fakes.modelGateway(
        withTitle([
          { when: "fix the typo", reply: "", tools: [add] },
          { when: "fix the typo", reply: "done" },
        ]),
      );
    },
  );

  let client: AcpClient;
  await given("the adapter runs that harness", async () => {
    client = await connect(sut, gateway);
  });

  let turn: AcpTurn;
  await when('the client starts a session in "$INPUT/app" and sends the prompt "fix the typo"', async () => {
    turn = await (await client.newSession("$INPUT/app")).prompt("fix the typo");
  });

  await then('the turn ends with "end_turn" and the reply "done"', async () => {
    expect(turn).toEqual({ stopReason: "end_turn", reply: "done" });
  });

  await then('"$INPUT/app/notes.md" says "fixed"', async () => {
    expect(await sut.files.read("$INPUT/app/notes.md")).toBe("fixed\n");
  });
});
