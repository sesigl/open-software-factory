// ledger ingest: read spend rows, runs and events from files and folders into the database file.
import { validate } from "@opensoftware/contracts";
import type { Ledger } from "../adapters/duckdb.ts";
import { readObjects } from "../adapters/files.ts";
import { readRecords } from "../domain/records.ts";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Reads every file before it writes, so a usage error leaves the database as it was. */
export async function ingest(ledger: Ledger, paths: string[], db: string): Promise<string> {
  const records = readRecords(readObjects(paths), validate);
  await ledger.write(records);
  const skipped = records.skipped ? `; skipped ${count(records.skipped, "event", "events")} of another type` : "";
  return `ingested ${count(records.runs.length, "run", "runs")}, ${count(records.spend.length, "spend row", "spend rows")} and ${count(records.events.length, "event", "events")} into ${db}${skipped}`;
}
