// Score records as scorekit writes them, and the files the scenarios start from.

/** A trace ID of 32 hex digits made from the run ID. */
const traceOf = (run: string): string => Buffer.from(run.padEnd(16, "-")).toString("hex").slice(-32);

export interface ScoreOptions {
  reason?: string;
  time?: string;
}

/** One BOOLEAN score of the scorer for the run. */
export function score(scorer: string, run: string, failed: boolean, options: ScoreOptions = {}) {
  return {
    id: `${scorer}-${run}-${options.time ?? "t"}`,
    name: scorer,
    value: failed ? 0 : 1,
    dataType: "BOOLEAN",
    traceId: traceOf(run),
    comment: options.reason ?? (failed ? "Investigated inline." : "Used the research skill."),
    timestamp: options.time ?? "2026-01-01T00:00:00Z",
    source: "API",
    metadata: { "osf.run.id": run, "osf.scorer.version": "sha256:000000000000", "osf.judge.model": "judge" },
  };
}

/** `count` scores of the scorer for the runs `<prefix>-<n>`, all failed or all passed. */
export const scores = (scorer: string, prefix: string, count: number, failed: boolean, options: ScoreOptions = {}) =>
  Array.from({ length: count }, (_, index) => score(scorer, `${prefix}-${index + 1}`, failed, options));

export const jsonl = (records: unknown[]): string => `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;

/**
 * Scores of "research-skill-used" around the merge at 2026-01-10T00:00:00Z: `failedBefore` of `before` runs on
 * 2026-01-05, `failedAfter` of `after` runs on 2026-01-15.
 */
export function aroundMerge(failedBefore: number, before: number, failedAfter: number, after: number): string {
  const side = (prefix: string, failed: number, total: number, time: string) => [
    ...scores("research-skill-used", `${prefix}-failed`, failed, true, { time }),
    ...scores("research-skill-used", `${prefix}-passed`, total - failed, false, { time }),
  ];
  return jsonl([
    ...side("before", failedBefore, before, "2026-01-05T00:00:00Z"),
    ...side("after", failedAfter, after, "2026-01-15T00:00:00Z"),
  ]);
}

export const MERGED_AT = "2026-01-10T00:00:00Z";

/** A problems.json as "observer analyze" writes it. */
export function problemsJson(failures: number, scored: number): string {
  const runs = Array.from({ length: failures }, (_, index) => ({
    run: `run-${index + 1}`,
    trace: traceOf(`run-${index + 1}`),
    time: "2026-01-01T00:00:00.000Z",
    reason: "Investigated inline.",
    links: index === 0 ? ["https://langfuse.example/trace/1"] : [],
  }));
  const problem = {
    id: "research-skill-used",
    failures,
    scored,
    failureRate: failures / scored,
    reasons: [{ reason: "Investigated inline.", count: failures }],
    runs,
  };
  return `${JSON.stringify({ minFailures: 1, problems: [problem] }, null, 2)}\n`;
}

export const problemsOf = (text: string) =>
  (
    JSON.parse(text) as {
      problems: {
        id: string;
        failures: number;
        scored: number;
        reasons: { reason: string; count: number }[];
        runs: { run: string; links: string[] }[];
      }[];
    }
  ).problems;

/** A run record as runlog writes it: an OTLP/JSON trace export request with the root span of the run. */
export function runRecord(
  run: string,
  {
    transcript = "",
    pullRequest = "",
    start = "2026-01-01T00:00:00Z",
  }: { transcript?: string; pullRequest?: string; start?: string },
) {
  const string = (value: string) => ({ stringValue: value });
  return {
    resourceSpans: [
      {
        resource: { attributes: [{ key: "osf.run.id", value: string(run) }] },
        scopeSpans: [
          {
            spans: [
              {
                traceId: "0af7651916cd43dd8448eb211c80319c",
                spanId: "b7ad6b7169203331",
                name: "invoke_agent",
                startTimeUnixNano: `${BigInt(Date.parse(start)) * 1_000_000n}`,
                endTimeUnixNano: `${BigInt(Date.parse(start) + 60_000) * 1_000_000n}`,
                attributes: [
                  { key: "osf.transcript.uri", value: string(transcript) },
                  { key: "osf.pull_request.urls", value: { arrayValue: { values: [string(pullRequest)] } } },
                ],
              },
              {
                traceId: "0af7651916cd43dd8448eb211c80319c",
                spanId: "c7ad6b7169203332",
                parentSpanId: "b7ad6b7169203331",
                name: "execute_tool",
                attributes: [{ key: "osf.transcript.uri", value: string("https://langfuse.example/not-the-run") }],
              },
            ],
          },
        ],
      },
    ],
  };
}
