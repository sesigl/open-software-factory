import { scenario } from "@opensoftware/testkit";
import { call, calls, config, gateways, provider } from "./gateway.ts";

scenario("SCN-INFER-007", async ({ sut, fakes, given, when, then }) => {
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
    await when('a run calls "routes/review" with its key', async () => {
      answer = await call(gateway.url, await box.key(gateway.id, "run-1"), { model: "routes/review" });
    });

    await then('the call gets the status 400 with an error that names "routes/review"', async () => {
      expect(answer.status).toBe(400);
      expect(JSON.stringify(answer.body)).toContain("routes/review");
    });

    await then("the test provider received no call", async () => {
      expect(calls(api)).toEqual([]);
    });
  } finally {
    await box.stopAll();
  }
});
