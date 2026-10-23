import { type AcpClient, type AcpTurn, type ModelGateway, scenario } from "@opensoftware/testkit";
import { connect, messagesCalls, until } from "./claude.ts";

scenario("SCN-HARNESS-005", async ({ sut, fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('a harness scripted to keep its turn for "add a date" running until it receives "never"', async () => {
    gateway = await fakes.modelGateway([{ when: "add a date", reply: "", hangs: true }]);
  });

  let client: AcpClient;
  await given("the adapter runs that harness", async () => {
    client = await connect(sut, gateway);
  });

  let turn: AcpTurn;
  let seconds = 0;
  await when('the client sends the prompt "add a date" and cancels the session while the turn runs', async () => {
    const session = await client.newSession();
    const running = session.prompt("add a date");
    await until(() => messagesCalls(gateway).length > 0);
    const cancelled = Date.now();
    await session.cancel();
    turn = await running;
    seconds = (Date.now() - cancelled) / 1000;
  });

  await then('the turn ends with "cancelled" within 5 seconds', async () => {
    expect(turn.stopReason).toBe("cancelled");
    expect(seconds).toBeLessThan(5);
  });
});
