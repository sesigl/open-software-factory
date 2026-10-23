import { type AcpClient, type AcpTurn, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, messagesCalls, until } from "./claude.ts";

scenario("SCN-HARNESS-013", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'a harness scripted to keep its turn for "add a date" running until it receives "never", and to reply "done" to "fix the typo"',
    async () => {
      gateway = await fakes.modelGateway([
        { when: "add a date", reply: "", hangs: true },
        { when: "fix the typo", reply: "done" },
      ]);
    },
  );

  let client: AcpClient;
  await given("the adapter runs that harness", async () => {
    client = await connect(sut, gateway);
  });

  let turn: AcpTurn;
  await when(
    'the client cancels the turn of "add a date", waits 4 seconds and sends the prompt "fix the typo"',
    async () => {
      const session = await client.newSession();
      const running = session.prompt("add a date");
      await until(() => messagesCalls(gateway).length > 0);
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
