// A PostgreSQL database: the tables of sql/postgres/tables.sql, filled by ingest, and the views of views.sql
// (ADR 0035). They live in the first schema of the connection's search_path.
import { readFileSync } from "node:fs";
import pg from "pg";
import type { Records } from "../domain/records.ts";
import { chunks, type TableRows, tableRows } from "../domain/tables.ts";
import type { Ledger, Row } from "./ledger.ts";

/** The SQL files the package ships in sql/postgres/, next to dist/. */
const sql = (file: string) => readFileSync(new URL(`../../sql/postgres/${file}`, import.meta.url), "utf8");

/** Any number that ledger creates the tables and views under, so two ledgers never create them at once. */
const SCHEMA_LOCK = 4_715_002;

/** Connects and creates the tables and views. `name` is the URL without its password, for messages. */
export async function openPostgres(url: string, name: string): Promise<Ledger> {
  const client = new pg.Client({ connectionString: url, types: { getTypeParser } });
  try {
    await client.connect();
    await transaction(client, async () => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_LOCK]);
      await client.query(sql("tables.sql"));
      await client.query(sql("views.sql"));
    });
  } catch (error) {
    await client.end().catch(() => {});
    throw new Error(`cannot open ${name}: ${(error as Error).message}`);
  }
  return {
    name,
    dialect: {
      hours: (from, to) => `extract(epoch FROM ${to} - ${from})::DOUBLE PRECISION / 3600`,
      day: (column) => `to_char(${column}, 'YYYY-MM-DD')`,
      sorted: (column) => `${column} COLLATE "C"`,
    },
    write: (records) => transaction(client, () => write(client, records)),
    query: async (statement, parameters = []) => (await client.query(statement, parameters)).rows as Row[],
    close: () => client.end(),
  };
}

/** Times without a zone are UTC; bigint and numeric are numbers, as DuckDB gives them. */
const getTypeParser = ((oid: number, format?: "text" | "binary") => {
  if (oid === pg.types.builtins.TIMESTAMP) return (text: string) => new Date(`${text.replace(" ", "T")}Z`);
  if (oid === pg.types.builtins.INT8 || oid === pg.types.builtins.NUMERIC) return Number;
  return pg.types.getTypeParser(oid, format);
}) as typeof pg.types.getTypeParser;

/** A failed statement leaves the transaction open; closing the connection, which every caller does, rolls it back. */
async function transaction(client: pg.Client, work: () => Promise<void>): Promise<void> {
  await client.query("BEGIN");
  await work();
  await client.query("COMMIT");
}

/** Inserts the records. A record whose key is already there replaces the old one. */
async function write(client: pg.Client, records: Records): Promise<void> {
  const { relinked, tables } = tableRows(records);
  for (const chunk of chunks(relinked)) await client.query("DELETE FROM run_links WHERE run_id = ANY($1)", [chunk]);
  for (const table of tables) await upsert(client, table);
}

/** INSERT ... ON CONFLICT DO UPDATE of many rows, a few hundred per statement. */
async function upsert(client: pg.Client, { table, columns, keys, times, rows }: TableRows) {
  const rest = columns.slice(keys);
  const conflict = `ON CONFLICT (${columns.slice(0, keys).join(", ")}) ${
    rest.length ? `DO UPDATE SET ${rest.map((column) => `${column} = EXCLUDED.${column}`).join(", ")}` : "DO NOTHING"
  }`;
  for (const chunk of chunks(rows)) {
    const tuples = chunk.map(
      (_, row) =>
        `(${columns
          .map((column, index) => `$${row * columns.length + index + 1}${times.includes(column) ? "::TIMESTAMP" : ""}`)
          .join(", ")})`,
    );
    await client.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${tuples.join(", ")} ${conflict}`,
      chunk.flat(),
    );
  }
}
