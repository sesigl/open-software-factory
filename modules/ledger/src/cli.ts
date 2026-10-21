#!/usr/bin/env node
// ledger <command>: the entry layer only parses arguments and calls the commands.
import { join } from "node:path";
import { parseArgs } from "node:util";
import { openLedger } from "./adapters/ledger.ts";
import { dashboard } from "./commands/dashboard.ts";
import { ingest } from "./commands/ingest.ts";
import { query } from "./commands/query.ts";
import { report } from "./commands/report.ts";
import { check, UsageError } from "./domain/errors.ts";

const HELP = `Usage: ledger <command> [options]

Commands:
  ingest [--db <file or URL>] <file or folder>...  Read LiteLLM spend log rows, OTLP/JSON runs and CloudEvents (.json, .jsonl) into the database --db.
  report [--db <file or URL>] [--since <date>] [--until <date>] [--target <usd>] [--compute-usd-per-hour <usd>] [--platform-usd <usd>] [--out <file>] [--markdown <file>] [<file or folder>...]
         Ingest the files named, then write cost per pull request, spend, throughput, cycle time, runs and revert rate to --out ($OUTPUT/report.json), and as Markdown to --markdown.
  query [--db <file or URL>] <SQL>  Run one SQL statement, like "SELECT * FROM pr_cost", and print its rows as JSON Lines.
  dashboard [--out <file>]  Write the Grafana dashboard over the PostgreSQL views to --out ($OUTPUT/ledger-dashboard.json).

--db is a DuckDB file or a postgres:// URL; its default is $LEDGER_DB, else ledger.duckdb.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    db: { type: "string", default: process.env.LEDGER_DB || "ledger.duckdb" },
    out: { type: "string" },
    markdown: { type: "string" },
    since: { type: "string" },
    until: { type: "string" },
    target: { type: "string" },
    "compute-usd-per-hour": { type: "string", default: "0" },
    "platform-usd": { type: "string", default: "0" },
  },
});
const [command, ...paths] = positionals;

/** A day as YYYY-MM-DD, or null when the option is not given. */
const day = (name: string, value: string | undefined): string | null => {
  check(value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value), `--${name} takes a date like 2026-01-31`);
  return value ?? null;
};
const usd = (name: string, value: string): number => {
  check(/^\d+(\.\d+)?$/.test(value), `--${name} takes an amount in USD like 15 or 0.50`);
  return Number(value);
};

async function main(): Promise<string[]> {
  const options = {
    since: day("since", values.since),
    until: day("until", values.until),
    target: values.target === undefined ? null : usd("target", values.target),
    computeUsdPerHour: usd("compute-usd-per-hour", values["compute-usd-per-hour"]),
    platformUsd: usd("platform-usd", values["platform-usd"]),
  };
  const output = (file: string) => values.out ?? join(process.env.OUTPUT ?? ".", file);
  if (command === "dashboard") return [dashboard(output("ledger-dashboard.json"))];
  const ledger = await openLedger(values.db);
  try {
    if (command === "ingest") return [await ingest(ledger, paths)];
    if (command === "query") return await query(ledger, paths.join(" "));
    const ingested = paths.length ? [await ingest(ledger, paths)] : [];
    return [...ingested, ...(await report(ledger, options, { out: output("report.json"), markdown: values.markdown }))];
  } finally {
    await ledger.close();
  }
}

if (["ingest", "report", "query", "dashboard"].includes(command as string) && !values.help) {
  try {
    const lines = await main();
    if (lines.length) process.stdout.write(`${lines.join("\n")}\n`);
  } catch (error) {
    process.stderr.write(`ledger: ${(error as Error).message}\n`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
} else {
  (values.help ? process.stdout : process.stderr).write(HELP);
  process.exitCode = values.help ? 0 : 2;
}
