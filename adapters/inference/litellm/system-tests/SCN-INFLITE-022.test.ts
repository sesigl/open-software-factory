import { scenario } from "@opensoftware/testkit";
import { attached, cli, runKey } from "./proxy.ts";

scenario("SCN-INFLITE-022", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'a test proxy that answers "/key/list", "/key/generate" with the key "sk-run-7" and the token "token-7", "/key/delete", and "/spend/logs" with a call of "token-7" and one of "token-other"',
    async () => {
      proxy = await fakes.http([
        { path: "/key/list?size=1", body: { keys: [] } },
        { method: "POST", path: "/key/generate", body: { key: "sk-run-7", token: "token-7" } },
        { method: "POST", path: "/key/delete", body: { deleted_keys: ["token-7"] } },
        {
          path: "/spend/logs",
          body: [
            { request_id: "call-1", api_key: "token-7", startTime: "2026-01-01T00:00:01Z" },
            { request_id: "call-2", api_key: "token-other", startTime: "2026-01-01T00:00:02Z" },
          ],
        },
      ]);
    },
  );

  let gateway = { id: "", url: "" };
  await given('a gateway attached to the test proxy, and a key of it for the run "run-7"', async () => {
    gateway = await attached(sut, proxy.url);
    await runKey(sut, gateway.id, "run-7");
  });

  let spendLog: Awaited<ReturnType<typeof cli>>;
  await when('the client runs "revoke" for the run "run-7", and then "spend-log" for the gateway', async () => {
    expect((await cli(sut, ["revoke", gateway.id, "run-7"])).exitCode).toBe(0);
    spendLog = await cli(sut, ["spend-log", gateway.id]);
  });

  await then('spend-log prints one line, whose "api_key" is "token-7"', async () => {
    expect(spendLog.exitCode, spendLog.stderr).toBe(0);
    const lines = spendLog.stdout.trimEnd().split("\n");
    expect(lines.map((line) => (JSON.parse(line) as { api_key: string }).api_key)).toEqual(["token-7"]);
  });
});
