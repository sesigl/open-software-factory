import { scenario } from "@opensoftware/testkit";
import { attached, cli, runKey, twoKeysProxy } from "./proxy.ts";

scenario("SCN-INFLITE-019", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof twoKeysProxy>>;
  await given(
    'a test proxy that answers "/key/list", "/key/generate" with the token "token-7" and then "token-8", and "/key/delete"',
    async () => {
      proxy = await twoKeysProxy(fakes);
    },
  );

  let gateway = { id: "", url: "" };
  await given(
    'a gateway attached to the test proxy, with a key for the run "run-7" and one for the run "run-8"',
    async () => {
      gateway = await attached(sut, proxy.url);
      await runKey(sut, gateway.id, "run-7");
      await runKey(sut, gateway.id, "run-8");
    },
  );

  let first: Awaited<ReturnType<typeof cli>>;
  let second: Awaited<ReturnType<typeof cli>>;
  let stop: Awaited<ReturnType<typeof cli>>;
  await when(
    'the client runs "revoke" for the run "run-7", "revoke" for the run "run-9" without a key, and then "stop" for the gateway',
    async () => {
      first = await cli(sut, ["revoke", gateway.id, "run-7"]);
      second = await cli(sut, ["revoke", gateway.id, "run-9"]);
      stop = await cli(sut, ["stop", gateway.id]);
    },
  );

  await then("each exits with code 0 and prints nothing but the line of stop", async () => {
    expect([first, second, stop].map((run) => [run.exitCode, run.stdout, run.stderr])).toEqual([
      [0, "", ""],
      [0, "", ""],
      [0, `stopped ${gateway.id}\n`, ""],
    ]);
  });

  await then('the test proxy received "/key/generate" with a different "key" for each run', async () => {
    const keys = proxy
      .received()
      .filter((request) => request.path === "/key/generate")
      .map((request) => (request.body as { key: string }).key);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });

  await then(
    'the test proxy received "/key/delete" with the keys "token-7", and then with the keys "token-8"',
    async () => {
      const deletes = proxy.received().filter((request) => request.path === "/key/delete");
      expect(deletes.map((request) => request.body)).toEqual([{ keys: ["token-7"] }, { keys: ["token-8"] }]);
    },
  );
});
