import { scenario } from "@opensoftware/testkit";
import { call } from "./gateway.ts";
import { attached, cli, MASTER_KEY, runKey, runningProxy } from "./proxy.ts";

scenario("SCN-INFLITE-003", async ({ sut, fakes, given, when, then }) => {
  let gateway = { id: "", url: "" };
  await given("a gateway attached to the running LiteLLM proxy", async () => {
    gateway = await attached(sut, (await runningProxy(sut, fakes)).origin);
  });

  let key = "";
  await given('a key for the run "run-7"', async () => {
    key = await runKey(sut, gateway.id, "run-7");
  });

  await when("the client stops the gateway", async () => {
    const stop = await cli(sut, ["stop", gateway.id]);
    expect(stop.exitCode, stop.stderr).toBe(0);
  });

  await then('a call of the run to "routes/triage" gets the status 401', async () => {
    expect((await call(gateway.url, key, { model: "routes/triage" })).status).toBe(401);
  });

  await then('a call to "routes/triage" with the proxy\'s master key gets the status 200', async () => {
    const answer = await call(gateway.url, MASTER_KEY, { model: "routes/triage" });
    expect(answer.status, JSON.stringify(answer.body)).toBe(200);
  });

  await then("list does not print the gateway's ID", async () => {
    const list = await cli(sut, ["list"]);
    expect(list.exitCode, list.stderr).toBe(0);
    expect(list.stdout.split("\n")).not.toContain(gateway.id);
  });
});
