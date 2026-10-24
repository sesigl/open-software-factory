import { scenario } from "@opensoftware/testkit";
import { call, calls, config, gateways, provider } from "./gateway.ts";

scenario("SCN-INFER-004", async ({ sut, fakes, given, when, then }) => {
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

    let answers: Awaited<ReturnType<typeof call>>[] = [];
    await when(
      'the run calls "routes/triage" twice, the client runs "spend-log", and the run calls "routes/triage" again',
      async () => {
        const triage = () => call(gateway.url, key, { model: "routes/triage" });
        answers = [await triage(), await triage()];
        // LiteLLM counts a call's spend just after its answer; once the spend log has it, the next call sees it.
        expect((await sut.cli(["spend-log", gateway.id])).exitCode).toBe(0);
        answers = [...answers, await triage()];
      },
    );

    await then("the first two calls get the status 200", async () => {
      expect(answers.slice(0, 2).map((answer) => answer.status)).toEqual([200, 200]);
    });

    await then(
      'the third call is refused with the error type "budget_exceeded" and a message that names the budget 0.0015',
      async () => {
        // LiteLLM answers 400 or 422, depending on where it notices the budget first.
        expect([400, 422]).toContain(answers[2]?.status);
        const error = answers[2]?.body.error as { type: string; message: string };
        expect(error.type).toBe("budget_exceeded");
        expect(error.message).toMatch(/[Bb]udget.*0\.0015/);
      },
    );

    await then("the test provider received two calls", async () => {
      expect(calls(api)).toHaveLength(2);
    });
  } finally {
    await box.stopAll();
  }
});
