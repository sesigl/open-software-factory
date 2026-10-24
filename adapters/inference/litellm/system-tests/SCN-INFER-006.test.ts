import { scenario } from "@opensoftware/testkit";
import { call, calls, config, gateways, provider } from "./gateway.ts";

scenario("SCN-INFER-006", async ({ sut, fakes, given, when, then }) => {
  const api = await provider(fakes, 1);
  const box = gateways(sut);
  try {
    let gateway = { id: "", url: "" };
    await given(
      'a gateway started from a config that routes "routes/triage" to the test provider\'s model "model-c"',
      async () => {
        gateway = await box.start(config(api.containerUrl as string, [{ alias: "routes/triage", model: "model-c" }]));
      },
    );

    let answer: Awaited<ReturnType<typeof call>>;
    await when('a client calls "routes/triage" with the key "sk-unknown"', async () => {
      answer = await call(gateway.url, "sk-unknown", { model: "routes/triage" });
    });

    await then("the call gets the status 401", async () => {
      expect(answer.status, JSON.stringify(answer.body)).toBe(401);
    });

    await then("the test provider received no call", async () => {
      expect(calls(api)).toEqual([]);
    });
  } finally {
    await box.stopAll();
  }
});
