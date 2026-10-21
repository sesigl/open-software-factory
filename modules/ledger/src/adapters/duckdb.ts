// The DuckDB database file: the tables of sql/duckdb/tables.sql, filled by ingest, and the views of views.sql.
import { readFileSync } from "node:fs";
import { DuckDBInstance, type DuckDBConnection, type DuckDBValue } from "@duckdb/node-api";
import type { Event, Records } from "../domain/records.ts";
import { utc } from "../domain/records.ts";

/** The SQL files the package ships in sql/duckdb/, next to dist/. */
const sql = (file: string) => readFileSync(new URL(`../../sql/duckdb/${file}`, import.meta.url), "utf8");

export type Row = Record<string, unknown>;

export interface Ledger {
  write(records: Records): Promise<void>;
  query(statement: string, parameters?: DuckDBValue[]): Promise<Row[]>;
  close(): void;
}

/** Opens or creates the database file with its tables and views. No extension is loaded or installed. */
export async function openLedger(path: string): Promise<Ledger> {
  const instance = await DuckDBInstance.create(path, {
    autoinstall_known_extensions: "false",
    autoload_known_extensions: "false",
  });
  const connection = await instance.connect();
  await connection.run(sql("tables.sql"));
  await connection.run(sql("views.sql"));
  return {
    write: (records) => write(connection, records),
    query: async (statement, parameters = []) =>
      (await connection.runAndReadAll(statement, parameters)).getRowObjectsJS() as Row[],
    close: () => {
      connection.closeSync();
      instance.closeSync();
    },
  };
}

/** Inserts the records in one transaction. A record whose key is already there replaces the old one. */
async function write(connection: DuckDBConnection, records: Records): Promise<void> {
  const run = (statement: string, values: DuckDBValue[]) => connection.run(statement, values);
  await connection.run("BEGIN TRANSACTION");
  for (const row of records.spend)
    await run("INSERT OR REPLACE INTO spend VALUES ($1, $2::TIMESTAMP, $3, $4, $5)", [
      row.requestId,
      row.startedAt,
      row.usd,
      row.model,
      row.runId,
    ]);
  for (const span of records.spans)
    await run("INSERT OR REPLACE INTO spans VALUES ($1, $2, $3)", [span.traceId, span.spanId, span.parentSpanId]);
  for (const row of records.runs) {
    await run("INSERT OR REPLACE INTO runs VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::TIMESTAMP, $10::TIMESTAMP, $11)", [
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
    ]);
    await run("DELETE FROM run_links WHERE run_id = $1", [row.runId]);
    for (const url of new Set(row.pullRequests))
      await run("INSERT INTO run_links VALUES ($1, $2)", [row.runId, url]);
  }
  for (const event of records.events) await writeEvent(run, event);
  await connection.run("COMMIT");
}

type Run = (statement: string, values: DuckDBValue[]) => Promise<unknown>;

async function writeEvent(run: Run, { type, source, id, time, data }: Event): Promise<void> {
  const at = utc(time) as string;
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  if (type === "work.received@v1")
    await run("INSERT OR REPLACE INTO work_items VALUES ($1, $2::TIMESTAMP)", [String(data.id), at]);
  if (type === "pr.opened@v1")
    await run("INSERT OR REPLACE INTO pull_requests VALUES ($1, $2, $3, $4::TIMESTAMP, $5, $6)", [
      String(data.url),
      String(data.title),
      String((data.author as { id: string }).id),
      at,
      text(data.workItemId),
      text(data.runId),
    ]);
  if (type === "pr.reviewed@v1")
    await run("INSERT OR REPLACE INTO reviews VALUES ($1, $2, $3, $4, $5, $6, $7::TIMESTAMP)", [
      source,
      id,
      String(data.url),
      String((data.reviewer as { id: string }).id),
      data.automated === true,
      String(data.state),
      at,
    ]);
  if (type === "pr.closed@v1")
    await run("INSERT OR REPLACE INTO closes VALUES ($1, $2::TIMESTAMP, $3)", [String(data.url), at, data.merged === true]);
}
