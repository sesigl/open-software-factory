import { type AcpClient, type Harness, scenario } from "@opensoftware/testkit";
import { serve } from "./proxy.ts";

scenario("SCN-HPROXY-019", async ({ sut, fakes, given, when, then }) => {
  let harness: Harness;
  await given("a harness scripted to end every turn", async () => {
    harness = await fakes.harness([]);
  });

  let client: AcpClient;
  await given("serveProxy runs that harness for a client that initialized the connection", async () => {
    client = await serve(sut, harness);
  });

  let hungUp = 0;
  await when("the client hangs up", async () => {
    hungUp = performance.now();
    await client.hangUp();
  });

  await then("serveProxy ends within 100 milliseconds", async () => {
    expect(await client.exited()).toBe(0);
    expect(performance.now() - hungUp).toBeLessThan(100);
  });
});
