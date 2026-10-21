// The rows each table of sql/<engine>/tables.sql receives from the input records, the same for every engine.
import type { Records } from "./records.ts";
import { utc } from "./records.ts";

export type Value = string | number | boolean | null;

export interface TableRows {
  table: string;
  columns: string[];
  /** The columns of the primary key: the first `keys` columns. */
  keys: number;
  /** The columns that hold a time; the engine casts their text to TIMESTAMP. */
  times: string[];
  /** Of rows with the same key, the last one wins. */
  rows: Value[][];
}

export interface Writes {
  /** The runs whose links to pull requests are replaced: a run ingested again keeps only the ones it lists now. */
  relinked: string[];
  /** In the order to write them; `run_links` comes last. */
  tables: TableRows[];
}

export function tableRows(records: Records): Writes {
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const events = (type: string) => records.events.filter((event) => event.type === type);
  const table = (table: string, columns: string[], rows: Value[][], keys = 1, times: string[] = []): TableRows => {
    const unique = [...new Map(rows.map((row) => [JSON.stringify(row.slice(0, keys)), row])).values()];
    return { table, columns, keys, times, rows: unique };
  };
  return {
    relinked: records.runs.map((row) => row.runId),
    tables: [
      table(
        "spend",
        ["request_id", "started_at", "usd", "model", "run_id"],
        records.spend.map((row) => [row.requestId, row.startedAt, row.usd, row.model, row.runId]),
        1,
        ["started_at"],
      ),
      table(
        "spans",
        ["trace_id", "span_id", "parent_span_id"],
        records.spans.map((span) => [span.traceId, span.spanId, span.parentSpanId]),
        2,
      ),
      table(
        "runs",
        [
          "run_id",
          "trace_id",
          "span_id",
          "work_item_id",
          "source",
          "requester_id",
          "agent",
          "model",
          "started_at",
          "ended_at",
          "cost_usd",
        ],
        records.runs.map((row) => [
          row.runId,
          row.traceId,
          row.spanId,
          row.workItemId,
          row.source,
          row.requesterId,
          row.agent,
          row.model,
          row.startedAt,
          row.endedAt,
          row.costUsd,
        ]),
        1,
        ["started_at", "ended_at"],
      ),
      table(
        "work_items",
        ["id", "received_at"],
        events("work.received@v1").map(({ time, data }) => [String(data.id), utc(time) as string]),
        1,
        ["received_at"],
      ),
      table(
        "pull_requests",
        ["url", "title", "author_id", "opened_at", "work_item_id", "run_id"],
        events("pr.opened@v1").map(({ time, data }) => [
          String(data.url),
          String(data.title),
          String((data.author as { id: string }).id),
          utc(time) as string,
          text(data.workItemId),
          text(data.runId),
        ]),
        1,
        ["opened_at"],
      ),
      table(
        "reviews",
        ["source", "id", "url", "reviewer_id", "automated", "state", "reviewed_at"],
        events("pr.reviewed@v1").map(({ source, id, time, data }) => [
          source,
          id,
          String(data.url),
          String((data.reviewer as { id: string }).id),
          data.automated === true,
          String(data.state),
          utc(time) as string,
        ]),
        2,
        ["reviewed_at"],
      ),
      table(
        "closes",
        ["url", "closed_at", "merged"],
        events("pr.closed@v1").map(({ time, data }) => [String(data.url), utc(time) as string, data.merged === true]),
        1,
        ["closed_at"],
      ),
      table(
        "run_links",
        ["run_id", "pr_url"],
        records.runs.flatMap((row) => row.pullRequests.map((url) => [row.runId, url])),
        2,
      ),
    ],
  };
}

/** Rows in groups of a few hundred, one statement each. */
export function chunks<T>(rows: T[], size = 200): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size),
  );
}
