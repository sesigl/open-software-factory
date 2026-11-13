import { scenario } from "@opensoftware/testkit";
import { attached, cli, keyProxy, runKey } from "./proxy.ts";

scenario("SCN-INFLITE-019", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof keyProxy>>;
  await given(
    'a test proxy that answers "/key/list", "/key/generate" with the key "sk-run-7" and the token "token-7", and "/key/delete"',
    async () => {
      proxy = await keyProxy(fakes);
    },
  );

  let gateway = { id: "", url: "" };
  await given('a gateway attached to the test proxy, and a key of it for the run "run-7"', async () => {
    gateway = await attached(sut, proxy.url);
    await runKey(sut, gateway.id, "run-7");
  });

  let revoke: Awaited<ReturnType<typeof cli>>;
  let stop: Awaited<ReturnType<typeof cli>>;
  await when('the client runs "revoke" for the run "run-7", and then "stop" for the gateway', async () => {
    revoke = await cli(sut, ["revoke", gateway.id, "run-7"]);
    stop = await cli(sut, ["stop", gateway.id]);
  });

  await then("revoke and stop exit with code 0", async () => {
    expect([revoke.exitCode, revoke.stderr, stop.exitCode, stop.stderr]).toEqual([0, "", 0, ""]);
  });

  await then('the test proxy received "/key/delete" once, with the keys "token-7"', async () => {
    const deletes = proxy.received().filter((request) => request.path === "/key/delete");
    expect(deletes.map((request) => request.body)).toEqual([{ keys: ["token-7"] }]);
  });
});
