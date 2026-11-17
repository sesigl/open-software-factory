import { scenario } from "@opensoftware/testkit";
import { call } from "./gateway.ts";
import { attached, cli, MASTER_KEY, runKey, runningProxy } from "./proxy.ts";

/** The spend rows that the proxy wrote, read with its master key. */
async function written(origin: string): Promise<unknown[]> {
  const response = await fetch(`${origin}/spend/logs`, { headers: { authorization: `Bearer ${MASTER_KEY}` } });
  return (await response.json()) as unknown[];
}

scenario("SCN-INFLITE-023", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof runningProxy>>;
  await given(
    'the running LiteLLM proxy with "PROXY_BATCH_WRITE_AT" set to "10" and "SPEND_LOG_QUEUE_POLL_INTERVAL" set to "600"',
    async () => {
      const env = { PROXY_BATCH_WRITE_AT: "10", SPEND_LOG_QUEUE_POLL_INTERVAL: "600" };
      proxy = await runningProxy(sut, fakes, 2, env);
    },
  );

  let gateway = { id: "", url: "" };
  let key = "";
  await given(
    'a gateway attached to it with a config without "osf.proxy.proxy_batch_write_at", and a key for the run "run-7"',
    async () => {
      gateway = await attached(sut, proxy.origin, null);
      key = await runKey(sut, gateway.id, "run-7");
    },
  );

  let rows: Record<string, unknown>[] = [];
  await when(
    'a call with the proxy\'s master key is in "/spend/logs", the run calls "routes/triage" at once, and the client runs "spend-log"',
    async () => {
      // The master key's row appears when the proxy writes its queue: the next write is 10 to 15 seconds later.
      expect((await call(gateway.url, MASTER_KEY, { model: "routes/triage" })).status).toBe(200);
      const deadline = Date.now() + 30_000;
      while ((await written(proxy.origin)).length === 0 && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 100));
      expect((await call(gateway.url, key, { model: "routes/triage" })).status).toBe(200);
      const log = await cli(sut, ["spend-log", gateway.id]);
      expect(log.exitCode, log.stderr).toBe(0);
      rows = log.stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    },
  );

  await then('spend-log prints one line whose "osf.run.id" is "run-7"', async () => {
    const runs = rows.map(
      (row) => (row.metadata as { spend_logs_metadata?: Record<string, string> }).spend_logs_metadata,
    );
    expect(runs).toEqual([{ "osf.run.id": "run-7" }]);
  });
});
