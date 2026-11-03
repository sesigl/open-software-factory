import { scenario } from "@opensoftware/testkit";
import { call, models } from "./gateway.ts";
import { attached, cli, MASTER_KEY, runKey, runningProxy } from "./proxy.ts";

scenario("SCN-INFLITE-002", async ({ sut, fakes, given, when, then }) => {
  let proxy: Awaited<ReturnType<typeof runningProxy>>;
  let gateway = { id: "", url: "" };
  await given("a gateway attached to the running LiteLLM proxy", async () => {
    proxy = await runningProxy(sut, fakes, 2);
    gateway = await attached(sut, proxy.origin);
  });

  let key = "";
  await given('a key for the run "run-7"', async () => {
    key = await runKey(sut, gateway.id, "run-7");
  });

  let rows: Record<string, unknown>[] = [];
  await when(
    'the run calls "routes/triage", a client calls "routes/triage" with the proxy\'s master key, and the client runs "spend-log"',
    async () => {
      await call(gateway.url, key, { model: "routes/triage" });
      await call(gateway.url, MASTER_KEY, { model: "routes/triage" });
      const log = await cli(sut, ["spend-log", gateway.id]);
      expect(log.exitCode, log.stderr).toBe(0);
      rows = log.stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    },
  );

  await then('the test provider received two calls for the model "model-c"', async () => {
    expect(models(proxy.api)).toEqual(["model-c", "model-c"]);
  });

  await then('spend-log prints one line whose "osf.run.id" is "run-7"', async () => {
    const runs = rows.map(
      (row) => (row.metadata as { spend_logs_metadata?: Record<string, string> }).spend_logs_metadata,
    );
    expect(runs).toEqual([{ "osf.run.id": "run-7" }]);
  });
});
