// Builders for the files the scorekit tests put into $INPUT: OTLP/JSON runs, scorer files and score records. They
// only build strings; the tests put them into place through sut.files.

export interface RunOptions {
  /** Tool calls in order: name and the command or arguments it ran. */
  tools?: { name: string; arguments: string }[];
  /** A user message and the answer, as a run with prompt content carries them. */
  messages?: { user: string; answer: string };
}

/** A fixed hex ID of a text: its bytes as hex, padded with zeros or cut to `length` digits. */
const hexOf = (text: string, length: number): string =>
  Buffer.from(text).toString("hex").padEnd(length, "0").slice(0, length);

export const traceIdOf = (run: string): string => hexOf(run, 32);

const number = (key: string, value: number) => ({
  key,
  value: Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value },
});

const text = (key: string, value: string) => ({ key, value: { stringValue: value } });

/** One run as runlog writes it: one OTLP/JSON trace export request on one line. */
export function runLine(run: string, options: RunOptions = {}): string {
  const traceId = traceIdOf(run);
  const start = 1_767_225_600_000_000_000n;
  const span = (index: number, name: string, attributes: unknown[]) => ({
    traceId,
    spanId: hexOf(`${run}:${index}`, 16),
    ...(index ? { parentSpanId: hexOf(`${run}:0`, 16) } : {}),
    name,
    startTimeUnixNano: String(start + BigInt(index) * 1_000_000_000n),
    endTimeUnixNano: String(start + BigInt(index + 1) * 1_000_000_000n),
    attributes,
  });
  const spans = [
    span(0, "invoke_agent", [
      text("gen_ai.operation.name", "invoke_agent"),
      text("gen_ai.conversation.id", `session-${run}`),
      text("gen_ai.request.model", "claude-sonnet-5-5"),
      text("osf.outcome", "succeeded"),
      number("gen_ai.usage.input_tokens", 900),
      number("gen_ai.usage.output_tokens", 30),
      number("osf.cost.usd", 0.25),
      {
        key: "osf.pull_request.urls",
        value: { arrayValue: { values: [{ stringValue: `https://github.com/acme/web/pull/${run.slice(-2)}` }] } },
      },
    ]),
  ];
  if (options.messages)
    spans.push(
      span(spans.length, "chat claude-sonnet-5-5", [
        text("gen_ai.operation.name", "chat"),
        text(
          "gen_ai.input.messages",
          JSON.stringify([{ role: "user", parts: [{ type: "text", content: options.messages.user }] }]),
        ),
        text(
          "gen_ai.output.messages",
          JSON.stringify([{ role: "assistant", parts: [{ type: "text", content: options.messages.answer }] }]),
        ),
      ]),
    );
  for (const tool of options.tools ?? [])
    spans.push(
      span(spans.length, `execute_tool ${tool.name}`, [
        text("gen_ai.operation.name", "execute_tool"),
        text("gen_ai.tool.name", tool.name),
        text("gen_ai.tool.call.arguments", tool.arguments),
      ]),
    );
  return JSON.stringify({
    resourceSpans: [
      {
        resource: {
          attributes: [
            text("service.name", "claude-code"),
            text("osf.run.id", run),
            text("osf.harness.name", "claude-code"),
          ],
        },
        scopeSpans: [{ scope: { name: "@opensoftware/runlog" }, spans }],
      },
    ],
  });
}

/** The IDs "run-01" to "run-<count>". */
export const runIds = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `run-${String(index + 1).padStart(2, "0")}`);

export const runsFile = (runs: string[]): string => `${runs.map((run) => runLine(run)).join("\n")}\n`;

/** The judge's answer. */
export const verdict = (result: "pass" | "fail", reason: string): string => JSON.stringify({ result, reason });

/** The text that matches the judge call of one run: its transcript starts with "Run: <id>" and a line break. */
export const callFor = (run: string): string => `Run: ${run}\\n`;

/** The text every judge call contains. */
export const ANY_CALL = "Pass criterion";

/** A scorer file. */
export function scorerFile(front: Record<string, unknown>, prompt = "Judge the run."): string {
  const lines = Object.entries({ pass: "The run is fine.", ...front }).map(
    ([key, value]) => `${key}: ${JSON.stringify(value)}`,
  );
  return `---\n${lines.join("\n")}\n---\n${prompt}\n`;
}

/** The system and user message of a judge call the gateway received. */
export function messagesOf(call: { body: string }): { system: string; user: string } {
  const { messages } = JSON.parse(call.body) as { messages: { role: string; content: string }[] };
  return {
    system: messages.find((message) => message.role === "system")?.content ?? "",
    user: messages.find((message) => message.role === "user")?.content ?? "",
  };
}

export interface ScoreRecord {
  id: string;
  name: string;
  value: number;
  dataType: string;
  traceId: string;
  comment?: string;
  timestamp: string;
  source?: string;
  metadata: Record<string, unknown>;
}

/** A score record of the `score` contract. */
export function scoreRecord(
  run: string,
  value: 0 | 1,
  options: { name?: string; timestamp?: string; cost?: number; source?: "API" | "ANNOTATION"; comment?: string } = {},
): ScoreRecord {
  const name = options.name ?? "redundant-tests";
  return {
    id: Buffer.from(`${name}:${run}:${options.source ?? "API"}`).toString("hex"),
    name,
    value,
    dataType: "BOOLEAN",
    traceId: traceIdOf(run),
    comment: options.comment ?? (value ? "Fine." : "Not fine."),
    timestamp: options.timestamp ?? "2026-01-01T00:00:00Z",
    source: options.source ?? "API",
    metadata: {
      "osf.run.id": run,
      ...(options.cost === undefined ? {} : { "osf.judge.cost.usd": options.cost }),
    },
  };
}

export const jsonl = (records: unknown[]): string => `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;

/** The score records of a JSON Lines file's text; none for an empty or missing file. */
export const parseScores = (text: string | undefined): ScoreRecord[] =>
  (text ?? "")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as ScoreRecord);

/** The score records in $OUTPUT/scores.jsonl; none when the file does not exist. */
export async function outputScores(sut: {
  files: { list(dir?: string): Promise<string[]>; read(path: string): Promise<string> };
}): Promise<ScoreRecord[]> {
  const files = await sut.files.list("$OUTPUT");
  return files.includes("scores.jsonl") ? parseScores(await sut.files.read("$OUTPUT/scores.jsonl")) : [];
}

/** The run IDs of score records, sorted. */
export const runsOf = (scores: ScoreRecord[]): string[] =>
  scores.map((score) => String(score.metadata["osf.run.id"])).sort();

/** A labels file: one score record with the source ANNOTATION per run. */
export const labelsFile = (labels: Record<string, "pass" | "fail">, name = "redundant-tests"): string =>
  jsonl(
    Object.entries(labels).map(([run, label]) =>
      scoreRecord(run, label === "pass" ? 1 : 0, { name, source: "ANNOTATION" }),
    ),
  );
