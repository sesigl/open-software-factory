import { type RunSpan, runSpans } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CTR-011", async ({ given, when, then }) => {
  let value: unknown;
  await given('the spend log row {"request_id": "r1", "spend": 0.1}', async () => {
    value = { request_id: "r1", spend: 0.1 };
  });

  let spans: RunSpan[] | undefined;
  await when("the module reads the spans of the value", async () => {
    spans = runSpans(value);
  });

  await then("it gets no spans", async () => {
    expect(spans).toBeUndefined();
  });
});
