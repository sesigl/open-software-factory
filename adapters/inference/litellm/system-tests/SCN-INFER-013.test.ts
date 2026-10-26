import { scenario } from "@opensoftware/testkit";
import { config, gateways, models, post, responsesProvider } from "./gateway.ts";

scenario("SCN-INFER-013", async ({ sut, fakes, given, when, then }) => {
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

    const responses = (key: string) =>
      post(`${gateway.url}/responses`, { authorization: `Bearer ${key}` }, { model: "routes/triage", input: "hello" });
    let answer: Awaited<ReturnType<typeof post>>;
    await when('a run calls the Responses API at the gateway\'s URL with "routes/triage" and its key', async () => {
      answer = await responses(await box.key(gateway.id, "run-1"));
    });

    await then('the test provider received a call for the model "ft:triage-2026-10"', async () => {
      expect(models(api)).toEqual(["ft:triage-2026-10"]);
    });

    await then('the run gets a Responses answer with the output text "triaged"', async () => {
      expect(answer.status, JSON.stringify(answer.body)).toBe(200);
      expect(answer.body).toMatchObject({
        object: "response",
        output: [{ type: "message", content: [{ type: "output_text", text: "triaged" }] }],
      });
    });

    await then('the same call with the key "sk-unknown" gets the status 401', async () => {
      expect((await responses("sk-unknown")).status).toBe(401);
    });
  } finally {
    await box.stopAll();
  }
});
