// The input records: LiteLLM spend log rows, OTLP/JSON trace export requests and CloudEvents, turned into rows.
import { check } from "@opensoftware/cli";
import { type AttributeValue, type RunSpan, runSpans } from "@opensoftware/contracts";

export interface SpendRow {
  requestId: string;
  startedAt: string;
  usd: number;
  model: string | null;
  runId: string | null;
}

export interface RunRow {
  runId: string;
  traceId: string;
  spanId: string;
  workItemId: string | null;
  source: string | null;
  requesterId: string | null;
  agent: string | null;
  model: string | null;
  startedAt: string;
  endedAt: string;
  costUsd: number | null;
  pullRequests: string[];
}

export interface SpanRow {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
}

/** A CloudEvent of a type ledger reads, already checked against its contract. */
export interface Event {
  type: string;
  source: string;
  id: string;
  time: string;
  data: Record<string, unknown>;
}

export interface Records {
  spend: SpendRow[];
  runs: RunRow[];
  spans: SpanRow[];
  events: Event[];
  /** CloudEvents of types ledger does not read. */
  skipped: number;
}

/** The CloudEvent types ledger reads, by the contract format that checks them. */
export const EVENT_FORMATS: Record<string, string> = {
  "work.received@v1": "work-received",
  "pr.opened@v1": "pr-opened",
  "pr.reviewed@v1": "pr-reviewed",
  "pr.closed@v1": "pr-closed",
};

type Validate = (format: string, value: unknown) => { path: string; message: string }[];
type Located = { where: string; value: unknown };

/** Sorts each object into spend rows, runs and their spans, and events. `where` is "<file>:<line>". */
export function readRecords(objects: Located[], validate: Validate): Records {
  const records: Records = { spend: [], runs: [], spans: [], events: [], skipped: 0 };
  for (const { where, value } of objects) {
    const object = (value ?? {}) as Record<string, unknown>;
    const spans = runSpans(value);
    if (spans) readTrace(spans, records);
    else if (object.specversion !== undefined) readEvent(where, object, records, validate);
    else if (object.request_id !== undefined && object.spend !== undefined) records.spend.push(spendRow(where, object));
    else check(false, `${where}: not a run, a spend row or a CloudEvent`);
  }
  return records;
}

function readEvent(where: string, event: Record<string, unknown>, records: Records, validate: Validate): void {
  const format = EVENT_FORMATS[String(event.type)];
  if (!format) {
    records.skipped += 1;
    return;
  }
  const [problem] = validate(format, event);
  check(!problem, `${where}: not a valid ${event.type} event: ${problem?.path} ${problem?.message}`);
  records.events.push(event as unknown as Event);
}

function spendRow(where: string, row: Record<string, unknown>): SpendRow {
  const metadata = (row.metadata ?? {}) as { spend_logs_metadata?: Record<string, unknown> | null };
  const runId = metadata.spend_logs_metadata?.["osf.run.id"];
  const startedAt = utc(String(row.startTime));
  check(startedAt && typeof row.spend === "number", `${where}: a spend row needs a number "spend" and a "startTime"`);
  return {
    requestId: String(row.request_id),
    startedAt,
    usd: row.spend,
    model: typeof row.model === "string" && row.model ? row.model : null,
    runId: typeof runId === "string" ? runId : null,
  };
}

/** An ISO 8601 time as UTC "YYYY-MM-DD HH:MM:SS.sss", or undefined when it is no time. */
export function utc(time: string): string | undefined {
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().replace("T", " ").replace("Z", "");
}

const text = (value: AttributeValue): string | null => (typeof value === "string" && value ? value : null);

const nanosToUtc = (nanos: bigint): string => utc(new Date(Number(nanos / 1_000_000n)).toISOString()) as string;

function readTrace(spans: RunSpan[], records: Records): void {
  for (const span of spans) {
    records.spans.push({ traceId: span.traceId, spanId: span.spanId, parentSpanId: span.parentSpanId ?? null });
    const { resource, attributes: own } = span;
    if (own["gen_ai.operation.name"] !== "invoke_agent") continue;
    const urls = own["osf.pull_request.urls"];
    const cost = own["osf.cost.usd"];
    records.runs.push({
      runId: String(resource["osf.run.id"] ?? own["gen_ai.conversation.id"] ?? span.spanId),
      traceId: span.traceId,
      spanId: span.spanId,
      workItemId: text(resource["osf.work_item.id"]),
      source: text(resource["osf.source"]),
      requesterId: text(resource["osf.requester.id"]),
      agent: text(own["gen_ai.agent.name"]) ?? text(resource["osf.harness.name"]),
      model: text(own["gen_ai.response.model"]) ?? text(own["gen_ai.request.model"]),
      startedAt: nanosToUtc(span.start),
      endedAt: nanosToUtc(span.end),
      costUsd: typeof cost === "number" ? cost : null,
      pullRequests: Array.isArray(urls) ? urls.map(String) : [],
    });
  }
}
