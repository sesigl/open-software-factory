// ledger ingest: read spend rows, runs and events from files and folders into the database file.
import { validate } from "@opensoftware/contracts";
import { readJson, readObjects } from "../adapters/files.ts";
import type { Ledger } from "../adapters/ledger.ts";
import { priceRuns } from "../domain/prices.ts";
import { readRecords } from "../domain/records.ts";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Reads every file before it writes, so a usage error leaves the database as it was. With `prices`, a LiteLLM price
 * table, runs without their own cost cost their token usage.
 */
export async function ingest(ledger: Ledger, paths: string[], prices?: string): Promise<string[]> {
  const records = readRecords(readObjects(paths), validate);
  const unpriced = prices ? priceRuns(records.runs, readJson(prices), prices) : [];
  await ledger.write(records);
  const skipped = records.skipped ? `; skipped ${count(records.skipped, "event", "events")} of another type` : "";
  return [
    `ingested ${count(records.runs.length, "run", "runs")}, ${count(records.spend.length, "spend row", "spend rows")} and ${count(records.events.length, "event", "events")} into ${ledger.name}${skipped}`,
    ...unpriced,
  ];
}
