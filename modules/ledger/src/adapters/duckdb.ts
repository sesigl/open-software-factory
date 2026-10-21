// The DuckDB database file: the tables of sql/duckdb/tables.sql, filled by ingest, and the views of views.sql.
import { readFileSync } from "node:fs";
import { type DuckDBConnection, DuckDBInstance, type DuckDBValue } from "@duckdb/node-api";
import type { Records } from "../domain/records.ts";
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
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const events = (type: string) => records.events.filter((event) => event.type === type);
  const runs = records.runs.map((row) => [
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
  await connection.run("BEGIN TRANSACTION");
  await upsert(
    connection,
    "spend",
    ["", "TIMESTAMP", "", "", ""],
    records.spend.map((row) => [row.requestId, row.startedAt, row.usd, row.model, row.runId]),
  );
  await upsert(
    connection,
    "spans",
    ["", "", ""],
    records.spans.map((span) => [span.traceId, span.spanId, span.parentSpanId]),
    2,
  );
  await upsert(connection, "runs", ["", "", "", "", "", "", "", "", "TIMESTAMP", "TIMESTAMP", ""], runs);
  // A run ingested again keeps only the pull requests it lists now.
  for (const chunk of chunks(records.runs.map((row) => [row.runId])))
    await connection.run(
      `DELETE FROM run_links WHERE run_id IN (${chunk.map((_, index) => `$${index + 1}`).join(", ")})`,
      chunk.flat(),
    );
  const links = records.runs.flatMap((row) => row.pullRequests.map((url) => [row.runId, url]));
  await upsert(connection, "run_links", ["", ""], links, 2);
  await upsert(
    connection,
    "work_items",
    ["", "TIMESTAMP"],
    events("work.received@v1").map(({ time, data }) => [String(data.id), utc(time) as string]),
  );
  await upsert(
    connection,
    "pull_requests",
    ["", "", "", "TIMESTAMP", "", ""],
    events("pr.opened@v1").map(({ time, data }) => [
      String(data.url),
      String(data.title),
      String((data.author as { id: string }).id),
      utc(time) as string,
      text(data.workItemId),
      text(data.runId),
    ]),
  );
  await upsert(
    connection,
    "reviews",
    ["", "", "", "", "", "", "TIMESTAMP"],
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
  );
  await upsert(
    connection,
    "closes",
    ["", "TIMESTAMP", ""],
    events("pr.closed@v1").map(({ time, data }) => [String(data.url), utc(time) as string, data.merged === true]),
  );
  await connection.run("COMMIT");
}

/** INSERT OR REPLACE of many rows, a few hundred per statement. Of rows with the same key, the last one wins. */
async function upsert(connection: DuckDBConnection, table: string, casts: string[], rows: DuckDBValue[][], keys = 1) {
  const unique = [...new Map(rows.map((row) => [JSON.stringify(row.slice(0, keys)), row])).values()];
  for (const chunk of chunks(unique)) {
    const tuples = chunk.map(
      (_, row) =>
        `(${casts.map((cast, column) => `$${row * casts.length + column + 1}${cast && `::${cast}`}`).join(", ")})`,
    );
    await connection.run(`INSERT OR REPLACE INTO ${table} VALUES ${tuples.join(", ")}`, chunk.flat());
  }
}

function chunks<T>(rows: T[], size = 200): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size),
  );
}
