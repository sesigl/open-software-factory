// The database ledger writes to and reports from: a DuckDB file or a PostgreSQL database (ADR 0035).
import type { Records } from "../domain/records.ts";
import { openDuckDb } from "./duckdb.ts";
import { openPostgres } from "./postgres.ts";

export type Row = Record<string, unknown>;
export type Parameter = string | number | boolean | null;

/** The SQL that differs between the engines; every other query of the report is the same text on both. */
export interface Dialect {
  /** The hours from one time to another, as a double. */
  hours(from: string, to: string): string;
  /** A date or time as text like 2026-01-31. */
  day(column: string): string;
  /** A text column to sort by, in byte order. */
  sorted(column: string): string;
}

export interface Ledger {
  /** The database as it may be printed: the file, or the URL with *** for its password. */
  name: string;
  dialect: Dialect;
  write(records: Records): Promise<void>;
  query(statement: string, parameters?: Parameter[]): Promise<Row[]>;
  close(): Promise<void>;
}

const POSTGRES = /^postgres(ql)?:\/\//;

/** Opens or creates the database with its tables and views. `db` is a file path or a postgres:// URL. */
export function openLedger(db: string): Promise<Ledger> {
  return POSTGRES.test(db) ? openPostgres(db, printable(db)) : openDuckDb(db);
}

/** The URL with *** in place of its password. */
function printable(url: string): string {
  const parsed = URL.parse(url);
  if (!parsed?.password) return url;
  parsed.password = "***";
  return parsed.toString();
}
