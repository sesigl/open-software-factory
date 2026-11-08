import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { ANY_CALL, messagesOf, outputScores, scorerFile, traceIdOf, verdict } from "./runs.ts";

const SCORER = scorerFile({ pass: " No test repeats another. " }, "Look for tests that repeat each other.");

const text = (key: string, value: string) => ({ key, value: { stringValue: value } });
const list = (key: string, values: string[]) => ({
  key,
  value: { arrayValue: { values: values.map((one) => ({ stringValue: one })) } },
});
const START = 1_767_225_600_000_000_000n;
const at = (milliseconds: number) => String(START + BigInt(milliseconds) * 1_000_000n);
const traceId = traceIdOf("run-01");
const span = (id: string, name: string, from: number, to: number, attributes: unknown[]) => ({
  traceId,
  spanId: id.padEnd(16, "0"),
  name,
  startTimeUnixNano: at(from),
  endTimeUnixNano: at(to),
  attributes,
});
const request = (resource: unknown[], spans: unknown[]) =>
  JSON.stringify({ resourceSpans: [{ resource: { attributes: resource }, scopeSpans: [{ spans }] }] });

/** The first line holds a tool call of the run with a resource that is not the run's; the second the run's root. */
const RUNS = [
  request(
    [text("service.name", "claude-code")],
    [
      span("b1", "execute_tool Bash", 2000, 3000, [
        text("gen_ai.operation.name", "execute_tool"),
        text("gen_ai.tool.name", "Bash"),
        text("gen_ai.tool.call.arguments", '{"command":"npm test"}'),
        text("gen_ai.tool.call.result", "2 passed"),
      ]),
    ],
  ),
  request(
    [
      text("service.name", "claude-code"),
      text("osf.run.id", "run-01"),
      text("osf.harness.name", "claude-code"),
      text("osf.stage", ""),
    ],
    [
      span("c1", "chat claude-sonnet-5-5", 1000, 2000, [
        text("gen_ai.operation.name", "chat"),
        text(
          "gen_ai.input.messages",
          JSON.stringify([
            {
              role: "user",
              parts: [
                { type: "text", content: "Add a login page" },
                { type: "image", content: "a screenshot" },
                { type: "text", content: "" },
              ],
            },
          ]),
        ),
        text(
          "gen_ai.output.messages",
          JSON.stringify([{ role: "assistant", parts: [{ type: "text", content: "Done." }] }]),
        ),
      ]),
      span("a0", "invoke_agent", 0, 12_345, [
        text("gen_ai.operation.name", "invoke_agent"),
        text("gen_ai.conversation.id", "session-run-01"),
        text("gen_ai.request.model", "claude-sonnet-5-5"),
        text("osf.outcome", "succeeded"),
        list("osf.pull_request.urls", ["https://github.com/acme/web/pull/1", "https://github.com/acme/web/pull/2"]),
        list("osf.issue.urls", []),
        { key: "gen_ai.usage.input_tokens", value: { intValue: "900" } },
      ]),
      span("s0", "setup", -500, 0, []),
      span("r1", "execute_tool Read", 2000, 2500, [text("gen_ai.operation.name", "execute_tool")]),
    ],
  ),
];

const SYSTEM = [
  'You judge one session of a coding agent for the scorer "twins".',
  "",
  "Look for tests that repeat each other.",
  "",
  "Pass criterion: No test repeats another.",
  "",
  'Answer with one JSON object and nothing else: {"result": "pass" or "fail", "reason": "one or two sentences"}.',
].join("\n");

const TRANSCRIPT = [
  "Run: run-01",
  "Harness: claude-code",
  "Model: claude-sonnet-5-5",
  "Outcome: succeeded",
  "Pull requests: https://github.com/acme/web/pull/1, https://github.com/acme/web/pull/2",
  "Duration: 12.345 s",
  "Tokens: 900 in, 0 out",
  "",
  "Steps:",
  "[user] Add a login page",
  "[assistant] Done.",
  '[tool Bash] {"command":"npm test"}',
  "  result: 2 passed",
  "[tool Read]",
].join("\n");

/** The first 32 hex digits of the SHA-256 of "twins", a line break and "run-01". */
const SCORE_ID = "5dfcb907d5d15f86aa19d1fa43f9e1fe";
/** "sha256:" and the first 12 hex digits of the SHA-256 of SCORER. */
const VERSION = "sha256:eb86d001f9e3";

scenario("SCN-SCORE-047", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the scorer file "scorers/twins.md" with the prompt "Look for tests that repeat each other." and the pass criterion " No test repeats another. " with spaces around it',
    async () => {
      await sut.files.put("$INPUT/scorers/twins.md", SCORER);
    },
  );

  await given(
    'the runs file "runs.jsonl" with the run "run-01" in two lines, whose spans are not in start time order',
    async () => {
      await sut.files.put("$INPUT/runs.jsonl", `${RUNS.join("\n")}\n`);
    },
  );

  let gateway: ModelGateway;
  await given(
    'a model gateway that answers every judge call with the result "pass" and the reason "Fine."',
    async () => {
      gateway = await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("pass", "Fine.") }]);
    },
  );

  await when('the user runs "scorekit score --scorer scorers/twins.md runs.jsonl"', async () => {
    await sut.cli(["score", "--scorer", "scorers/twins.md", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then(
    `the judge call's system message names the scorer "twins", the prompt, the pass criterion without the spaces and the answer format`,
    async () => {
      expect(gateway.calls).toHaveLength(1);
      expect(messagesOf(gateway.calls[0] as { body: string }).system).toBe(SYSTEM);
    },
  );

  await then(
    `the judge call's user message lists the facts of "run-01" that have a value, then its messages and tool calls by start time`,
    async () => {
      expect(messagesOf(gateway.calls[0] as { body: string }).user).toBe(TRANSCRIPT);
    },
  );

  await then(
    'the score for "run-01" has the ID of "twins" and "run-01", the session ID "session-run-01", the time of the clock and the version of "scorers/twins.md"',
    async () => {
      expect(await outputScores(sut)).toEqual([
        {
          id: SCORE_ID,
          name: "twins",
          value: 1,
          dataType: "BOOLEAN",
          traceId,
          sessionId: "session-run-01",
          comment: "Fine.",
          timestamp: "2026-01-01T00:00:00Z",
          source: "API",
          metadata: {
            "osf.run.id": "run-01",
            "osf.scorer.version": VERSION,
            "osf.judge.model": "judge",
          },
        },
      ]);
    },
  );
});
