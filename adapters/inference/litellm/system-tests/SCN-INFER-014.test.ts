import { scenario } from "@opensoftware/testkit";
import { call, calls, config, gateways, provider } from "./gateway.ts";

scenario("SCN-INFER-014", async ({ sut, fakes, given, when, then }) => {
  const api = await provider(fakes, 3);
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
    await given('a key for the run "run-7" with the budget 0.0015 USD', async () => {
      key = await box.key(gateway.id, "run-7", "0.0015");
    });

    let again = "";
    await when(
      'the run calls "routes/triage" twice, the client runs "spend-log", and the client runs "key" for the run "run-7" with the budget 0.0015 USD again',
      async () => {
        for (let index = 0; index < 2; index++) {
          const answer = await call(gateway.url, key, { model: "routes/triage" });
          expect(answer.status, JSON.stringify(answer.body)).toBe(200);
        }
        // LiteLLM counts a call's spend just after its answer; once the spend log has it, the next call sees it.
        expect((await sut.cli(["spend-log", gateway.id])).exitCode).toBe(0);
        again = await box.key(gateway.id, "run-7", "0.0015");
      },
    );

    await then('the second "key" prints the same key', async () => {
      expect(again).toBe(key);
    });

    await then('the run\'s next call with that key is refused with the error type "budget_exceeded"', async () => {
      const answer = await call(gateway.url, again, { model: "routes/triage" });
      // LiteLLM answers 400 or 422, depending on where it notices the budget first.
      expect([400, 422]).toContain(answer.status);
      expect((answer.body.error as { type: string }).type).toBe("budget_exceeded");
    });

    await then("the test provider received two calls", async () => {
      expect(calls(api)).toHaveLength(2);
    });
  } finally {
    await box.stopAll();
  }
});
