import { type AcpClient, type AcpTurn, type Harness, scenario } from "@opensoftware/testkit";

scenario("SCN-HARNESS-013", async ({ sut, fakes, given, when, then }) => {
  let harness: Harness;
  await given(
    'a harness scripted to keep its turn for "add a date" running until it receives "never", and to reply "done" to "fix the typo"',
    async () => {
      harness = await fakes.harness([
        { when: "add a date", waitsFor: "never" },
        { when: "fix the typo", reply: "done" },
      ]);
    },
  );

  let client: AcpClient;
  await given("the adapter runs that harness", async () => {
    client = await sut.acp.connect(["run", "--", harness.command, ...harness.args]);
  });

  let turn: AcpTurn;
  await when(
    'the client cancels the turn of "add a date", waits 4 seconds and sends the prompt "fix the typo"',
    async () => {
      const session = await client.newSession();
      const running = session.prompt("add a date");
      await new Promise((resolve) => setTimeout(resolve, 200));
      await session.cancel();
      await running;
      await new Promise((resolve) => setTimeout(resolve, 4000));
      turn = await session.prompt("fix the typo");
    },
  );

  await then('the turn ends with "end_turn" and the reply "done"', async () => {
    expect(turn).toEqual({ stopReason: "end_turn", reply: "done" });
  });
});
