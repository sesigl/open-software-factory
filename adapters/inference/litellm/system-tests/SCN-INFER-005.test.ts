import { scenario } from "@opensoftware/testkit";
import { call, config, gateways, provider } from "./gateway.ts";

scenario("SCN-INFER-005", async ({ sut, fakes, given, when, then }) => {
  const api = await provider(fakes, 2);
  const box = gateways(sut);
  try {
    let gateway = { id: "", url: "" };
    await given(
      'a gateway started from a config that prices "routes/triage" at 0.000001 USD per prompt token and 0 per completion token',
      async () => {
        const params = [
          "      api_key: unused",
          "      input_cost_per_token: 0.000001",
          "      output_cost_per_token: 0",
        ];
        gateway = await box.start(
          config(api.containerUrl as string, [{ alias: "routes/triage", model: "model-c", params }]),
        );
      },
    );

    let key = "";
    await given('a key for the run "run-7"', async () => {
      key = await box.key(gateway.id, "run-7");
    });

    let rows: Record<string, unknown>[] = [];
    await when('the run calls "routes/triage" twice and the client runs "spend-log"', async () => {
      for (let index = 0; index < 2; index++) await call(gateway.url, key, { model: "routes/triage" });
      const run = await sut.cli(["spend-log", gateway.id]);
      rows = run.stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    });

    await then('spend-log prints two lines whose "osf.run.id" is "run-7"', async () => {
      const runs = rows.map(
        (row) => (row.metadata as { spend_logs_metadata?: Record<string, string> }).spend_logs_metadata,
      );
      expect(runs).toEqual([{ "osf.run.id": "run-7" }, { "osf.run.id": "run-7" }]);
    });

    await then('each line has the spend 0.001 and the model group "routes/triage"', async () => {
      expect(rows.map((row) => [row.spend, row.model_group])).toEqual([
        [0.001, "routes/triage"],
        [0.001, "routes/triage"],
      ]);
    });
  } finally {
    await box.stopAll();
  }
});
