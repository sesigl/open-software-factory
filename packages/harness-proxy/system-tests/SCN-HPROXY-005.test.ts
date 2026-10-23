import { type AcpClient, type AcpTurn, type Harness, scenario } from "@opensoftware/testkit";
import { serve } from "./proxy.ts";

scenario("SCN-HPROXY-005", async ({ sut, fakes, given, when, then }) => {
  let harness: Harness;
  await given('a harness scripted to keep its turn for "add a date" running and to ignore cancel', async () => {
    harness = await fakes.harness([{ when: "add a date", waitsFor: "never", ignoresCancel: true }]);
  });

  let client: AcpClient;
  await given("serveProxy runs that harness for the client", async () => {
    client = await serve(sut, harness);
  });

  let turn: AcpTurn;
  let seconds = 0;
  await when('the client sends the prompt "add a date" and cancels the session while the turn runs', async () => {
    const session = await client.newSession();
    const running = session.prompt("add a date");
    await new Promise((resolve) => setTimeout(resolve, 200));
    const cancelled = Date.now();
    await session.cancel();
    turn = await running;
    seconds = (Date.now() - cancelled) / 1000;
  });

  await then('the turn ends with "cancelled" within 5 seconds', async () => {
    expect(turn.stopReason).toBe("cancelled");
    expect(seconds).toBeGreaterThanOrEqual(3);
    expect(seconds).toBeLessThan(5);
  });

  await then("serveProxy ends", async () => {
    expect(await client.exited()).toBe(0);
  });
});
