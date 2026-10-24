import { scenario } from "@opensoftware/testkit";
import { call, config, gateways, models, provider } from "./gateway.ts";

scenario("SCN-INFER-001", async ({ sut, fakes, given, when, then }) => {
  const api = await provider(fakes, 1, "triaged");
  const box = gateways(sut);
  try {
    let gateway = { id: "", url: "" };
    await given(
      'a gateway started from a config that routes "routes/triage" to the test provider\'s model "ft:triage-2026-10"',
      async () => {
        const routes = [{ alias: "routes/triage", model: "ft:triage-2026-10" }];
        gateway = await box.start(config(api.containerUrl as string, routes));
      },
    );

    let answer: Awaited<ReturnType<typeof call>>;
    await when('a run calls "routes/triage" with its key', async () => {
      answer = await call(gateway.url, await box.key(gateway.id, "run-1"), { model: "routes/triage" });
    });

    await then('the test provider received a call for the model "ft:triage-2026-10"', async () => {
      expect(models(api)).toEqual(["ft:triage-2026-10"]);
    });

    await then('the run gets the test provider\'s reply "triaged"', async () => {
      const choices = answer.body.choices as { message: { content: string } }[];
      expect(choices[0]?.message.content, JSON.stringify(answer.body)).toBe("triaged");
    });
  } finally {
    await box.stopAll();
  }
});
