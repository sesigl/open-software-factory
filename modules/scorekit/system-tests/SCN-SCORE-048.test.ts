import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { ANY_CALL, messagesOf, outputScores, verdict } from "./runs.ts";

const START = "1767225600000000000";

/** A root span with the conversation ID only, which starts and ends at the same time, under a resource without a run ID. */
const RUN = JSON.stringify({
  resourceSpans: [
    {
      resource: { attributes: [{ key: "service.name", value: { stringValue: "claude-code" } }] },
      scopeSpans: [
        {
          spans: [
            {
              traceId: "7365737369006e2d74776f0000000000",
              spanId: "a000000000000000",
              name: "invoke_agent",
              startTimeUnixNano: START,
              endTimeUnixNano: START,
              attributes: [
                { key: "gen_ai.operation.name", value: { stringValue: "invoke_agent" } },
                { key: "gen_ai.conversation.id", value: { stringValue: "session-two" } },
              ],
            },
          ],
        },
      ],
    },
  ],
});

scenario("SCN-SCORE-048", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the runs file "runs.jsonl" with a run whose resource has no run ID and whose root span has only the conversation ID "session-two" and no duration',
    async () => {
      await sut.files.put("$INPUT/runs.jsonl", `${RUN}\n`);
    },
  );

  let gateway: ModelGateway;
  await given(
    'a model gateway that answers every judge call with the result "pass" and the reason "Fine."',
    async () => {
      gateway = await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("pass", "Fine.") }]);
    },
  );

  await when('the user runs "scorekit score --scorer redundant-tests --sample 1 runs.jsonl"', async () => {
    await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "1", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then(
    `the judge call's user message is "Run: session-two", an empty line, "Steps:" and "(none recorded)"`,
    async () => {
      expect(gateway.calls).toHaveLength(1);
      expect(messagesOf(gateway.calls[0] as { body: string }).user).toBe("Run: session-two\n\nSteps:\n(none recorded)");
    },
  );

  await then('"scores.jsonl" holds a score for "session-two"', async () => {
    expect(await outputScores(sut)).toMatchObject([{ metadata: { "osf.run.id": "session-two" } }]);
  });
});
