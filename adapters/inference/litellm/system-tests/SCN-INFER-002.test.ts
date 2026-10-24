import { scenario } from "@opensoftware/testkit";
import { call, config, gateways, models, provider } from "./gateway.ts";

scenario("SCN-INFER-002", async ({ sut, fakes, given, when, then }) => {
  const api = await provider(fakes, 1);
  const box = gateways(sut);
  try {
    let gateway = { id: "", url: "" };
    await given(
      'a gateway started from a config that routes "routes/triage" to "model-c" and "routes/implement" to "model-b"',
      async () => {
        const routes = [
          { alias: "routes/triage", model: "model-c" },
          { alias: "routes/implement", model: "model-b" },
        ];
        gateway = await box.start(config(api.containerUrl as string, routes));
      },
    );

    await when('a run calls "routes/implement" with its key', async () => {
      const answer = await call(gateway.url, await box.key(gateway.id, "run-1"), { model: "routes/implement" });
      expect(answer.status, JSON.stringify(answer.body)).toBe(200);
    });

    await then('the test provider received a call for the model "model-b" and none for "model-c"', async () => {
      expect(models(api)).toEqual(["model-b"]);
    });
  } finally {
    await box.stopAll();
  }
});
