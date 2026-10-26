import { scenario } from "@opensoftware/testkit";
import { config, gateways, models, post, responsesProvider } from "./gateway.ts";

scenario("SCN-INFER-012", async ({ sut, fakes, given, when, then }) => {
  const api = await responsesProvider(fakes, "triaged");
  const box = gateways(sut);
  try {
    let gateway = { id: "", url: "" };
    await given(
      'a gateway started from a config that routes "routes/triage" to the test provider\'s model "ft:triage-2026-10"',
      async () => {
        gateway = await box.start(
          config(api.containerUrl as string, [{ alias: "routes/triage", model: "ft:triage-2026-10" }]),
        );
      },
    );

    const messages = (key: string) =>
      post(
        `${gateway.url.replace(/\/v1$/, "")}/v1/messages`,
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        {
          model: "routes/triage",
          max_tokens: 100,
          messages: [{ role: "user", content: "hello" }],
        },
      );
    let answer: Awaited<ReturnType<typeof post>>;
    await when(
      'a run calls the Messages API at the gateway\'s URL without "/v1" with "routes/triage" and its key as "x-api-key"',
      async () => {
        answer = await messages(await box.key(gateway.id, "run-1"));
      },
    );

    await then('the test provider received a call for the model "ft:triage-2026-10"', async () => {
      expect(models(api)).toEqual(["ft:triage-2026-10"]);
    });

    await then('the run gets a Messages answer with the text "triaged"', async () => {
      expect(answer.status, JSON.stringify(answer.body)).toBe(200);
      expect(answer.body).toMatchObject({ type: "message", content: [{ type: "text", text: "triaged" }] });
    });

    await then('the same call with the key "sk-unknown" gets the status 401', async () => {
      expect((await messages("sk-unknown")).status).toBe(401);
    });
  } finally {
    await box.stopAll();
  }
});
