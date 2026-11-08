import { scenario } from "@opensoftware/testkit";
import { attached, cli, testProxy } from "./proxy.ts";

scenario("SCN-INFLITE-013", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof testProxy>>;
  await given('a test proxy that answers "/key/list" with the status 200', async () => {
    proxy = await testProxy(fakes, 200);
  });

  let gateway = { id: "", url: "" };
  await given("a gateway attached to the test proxy", async () => {
    gateway = await attached(sut, proxy.url);
  });

  let stop: Awaited<ReturnType<typeof cli>>;
  await when("the client stops the gateway", async () => {
    stop = await cli(sut, ["stop", gateway.id]);
  });

  await then('stop exits with code 0 and prints "stopped" and the gateway\'s ID', async () => {
    expect(stop.exitCode, stop.stderr).toBe(0);
    expect(stop.stdout).toBe(`stopped ${gateway.id}\n`);
  });

  await then('the test proxy received no request after "/key/list"', async () => {
    expect(proxy.requests()).toEqual(["GET /key/list?size=1"]);
  });

  await then("list does not print the gateway's ID", async () => {
    const list = await cli(sut, ["list"]);
    expect(list.exitCode, list.stderr).toBe(0);
    expect(list.stdout.split("\n")).not.toContain(gateway.id);
  });
});
