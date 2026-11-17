import { scenario } from "@opensoftware/testkit";
import { attached, cli } from "./proxy.ts";

scenario("SCN-INFLITE-025", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof fakes.http>>;
  await given('a test proxy that answers "/key/list" and "/spend/logs" with no call', async () => {
    proxy = await fakes.http([
      { path: "/key/list?size=1", body: { keys: [] } },
      { path: "/spend/logs", body: [] },
    ]);
  });

  let gateway = { id: "", url: "" };
  await given(
    'a gateway attached to the test proxy with a config whose "osf.proxy" names "proxy_batch_write_at" 2',
    async () => {
      gateway = await attached(sut, proxy.url, 2);
    },
  );

  let spendLog: Awaited<ReturnType<typeof cli>>;
  let seconds = 0;
  await when('the client runs "spend-log" for the gateway', async () => {
    const began = performance.now();
    spendLog = await cli(sut, ["spend-log", gateway.id]);
    seconds = (performance.now() - began) / 1000;
  });

  await then(
    "spend-log exits with code 0 after 9 seconds or more, and sooner than the 17 seconds of LiteLLM's default interval",
    async () => {
      expect(spendLog.exitCode, spendLog.stderr).toBe(0);
      expect(seconds).toBeGreaterThanOrEqual(9);
      expect(seconds).toBeLessThan(17);
    },
  );
});
