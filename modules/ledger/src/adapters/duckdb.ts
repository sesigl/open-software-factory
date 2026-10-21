// The DuckDB database file: the tables of sql/duckdb/tables.sql, filled by ingest, and the views of views.sql.
import { readFileSync } from "node:fs";
import { type DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import type { Records } from "../domain/records.ts";
import { chunks, type TableRows, tableRows } from "../domain/tables.ts";
import type { Ledger, Row } from "./ledger.ts";

/** The SQL files the package ships in sql/duckdb/, next to dist/. */
const sql = (file: string) => readFileSync(new URL(`../../sql/duckdb/${file}`, import.meta.url), "utf8");

/** Opens or creates the database file with its tables and views. No extension is loaded or installed. */
export async function openDuckDb(path: string): Promise<Ledger> {
  const instance = await DuckDBInstance.create(path, {
    autoinstall_known_extensions: "false",
    autoload_known_extensions: "false",
  });
  const connection = await instance.connect();
  await connection.run(sql("tables.sql"));
  await connection.run(sql("views.sql"));
  return {
    name: path,
    dialect: {
      hours: (from, to) => `date_diff('millisecond', ${from}, ${to}) / 3600000.0`,
      day: (column) => `strftime(${column}, '%Y-%m-%d')`,
      sorted: (column) => column,
    },
    write: (records) => write(connection, records),
    query: async (statement, parameters = []) =>
      (await connection.runAndReadAll(statement, parameters)).getRowObjectsJS() as Row[],
    close: async () => {
      connection.closeSync();
      instance.closeSync();
    },
  };
}

/** Inserts the records in one transaction. A record whose key is already there replaces the old one. */
async function write(connection: DuckDBConnection, records: Records): Promise<void> {
  const { relinked, tables } = tableRows(records);
  await connection.run("BEGIN TRANSACTION");
  for (const chunk of chunks(relinked))
    await connection.run(
      `DELETE FROM run_links WHERE run_id IN (${chunk.map((_, index) => `$${index + 1}`).join(", ")})`,
      chunk,
    );
  for (const table of tables) await upsert(connection, table);
  await connection.run("COMMIT");
}

/** INSERT OR REPLACE of many rows, a few hundred per statement. */
async function upsert(connection: DuckDBConnection, { table, columns, times, rows }: TableRows) {
  for (const chunk of chunks(rows)) {
    const tuples = chunk.map(
      (_, row) =>
        `(${columns
          .map((column, index) => `$${row * columns.length + index + 1}${times.includes(column) ? "::TIMESTAMP" : ""}`)
          .join(", ")})`,
    );
    await connection.run(`INSERT OR REPLACE INTO ${table} VALUES ${tuples.join(", ")}`, chunk.flat());
  }
}
