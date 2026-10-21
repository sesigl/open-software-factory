import { type RunSpan, runSpans } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CTR-010", async ({ given, when, then }) => {
  let record: unknown;
  await given(
    'a run record whose resource has "osf.run.id" "run-1" and whose span "invoke_agent" has the integer "gen_ai.usage.input_tokens" "1200", the double "osf.cost.usd" 0.42 and the array "osf.pull_request.urls" with "https://github.com/acme/web/pull/7"',
    async () => {
      record = {
        resourceSpans: [
          {
            resource: { attributes: [{ key: "osf.run.id", value: { stringValue: "run-1" } }] },
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
                    spanId: "00f067aa0ba902b7",
                    name: "invoke_agent",
                    startTimeUnixNano: "1767225600000000000",
                    endTimeUnixNano: "1767225660000000000",
                    attributes: [
                      { key: "gen_ai.usage.input_tokens", value: { intValue: "1200" } },
                      { key: "osf.cost.usd", value: { doubleValue: 0.42 } },
                      {
                        key: "osf.pull_request.urls",
                        value: { arrayValue: { values: [{ stringValue: "https://github.com/acme/web/pull/7" }] } },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
    },
  );

  let spans: RunSpan[] | undefined;
  await when("the module reads the spans of the run record", async () => {
    spans = runSpans(record);
  });

  await then('it gets one span named "invoke_agent" that starts at 1767225600000000000 nanoseconds', async () => {
    expect(spans?.map((span) => [span.name, span.start])).toEqual([["invoke_agent", 1767225600000000000n]]);
  });

  await then('the span\'s resource has "osf.run.id" "run-1"', async () => {
    expect(spans?.[0]?.resource).toEqual({ "osf.run.id": "run-1" });
  });

  await then(
    'the span has "gen_ai.usage.input_tokens" 1200, "osf.cost.usd" 0.42 and "osf.pull_request.urls" ["https://github.com/acme/web/pull/7"]',
    async () => {
      expect(spans?.[0]?.attributes).toEqual({
        "gen_ai.usage.input_tokens": 1200,
        "osf.cost.usd": 0.42,
        "osf.pull_request.urls": ["https://github.com/acme/web/pull/7"],
      });
    },
  );
});
