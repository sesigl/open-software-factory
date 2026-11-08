import { scenario } from "@opensoftware/testkit";
import { attached, cli, keyProxy } from "./proxy.ts";

scenario("SCN-INFLITE-012", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof keyProxy>>;
  await given(
    'a test proxy that answers "/key/list", "/key/generate" with the key "sk-run-7" and the token "token-7", and "/key/delete"',
    async () => {
      proxy = await keyProxy(fakes);
    },
  );

  let gateway = { id: "", url: "" };
  await given("a gateway attached to the test proxy", async () => {
    gateway = await attached(sut, proxy.url);
  });

  let key: Awaited<ReturnType<typeof cli>>;
  let stop: Awaited<ReturnType<typeof cli>>;
  await when(
    'the client runs "key" for the run "run-7" with "--budget 0", and then "stop" for the gateway',
    async () => {
      key = await cli(sut, ["key", gateway.id, "run-7", "--budget", "0"]);
      stop = await cli(sut, ["stop", gateway.id]);
    },
  );

  await then('key prints "sk-run-7"', async () => {
    expect(key.exitCode, key.stderr).toBe(0);
    expect(key.stdout).toBe("sk-run-7\n");
  });

  await then(
    'the test proxy received "/key/generate" as JSON with "max_budget" 0 and the "osf.run.id" "run-7" in "metadata.spend_logs_metadata"',
    async () => {
      const generate = proxy.headers().filter((request) => request.path === "/key/generate");
      expect(generate.map((request) => request.headers["content-type"])).toEqual(["application/json"]);
      expect(proxy.received().filter((request) => request.path === "/key/generate")).toEqual([
        {
          method: "POST",
          path: "/key/generate",
          body: { max_budget: 0, metadata: { spend_logs_metadata: { "osf.run.id": "run-7" } } },
        },
      ]);
    },
  );

  await then('the test proxy received "/key/delete" with the keys "token-7" only', async () => {
    const deletes = proxy.received().filter((request) => request.path === "/key/delete");
    expect(deletes.map((request) => request.body)).toEqual([{ keys: ["token-7"] }]);
  });

  await then('stop prints "stopped" and the gateway\'s ID', async () => {
    expect(stop.exitCode, stop.stderr).toBe(0);
    expect(stop.stdout).toBe(`stopped ${gateway.id}\n`);
  });

  await then("list does not print the gateway's ID", async () => {
    const list = await cli(sut, ["list"]);
    expect(list.exitCode, list.stderr).toBe(0);
    expect(list.stdout.split("\n")).not.toContain(gateway.id);
  });
});
