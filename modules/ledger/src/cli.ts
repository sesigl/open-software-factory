#!/usr/bin/env node
// ledger <command>: the entry layer only parses arguments and calls the commands.
import { parseArgs } from "node:util";
import { check, outputPath, runProgram } from "@opensoftware/cli";
import { openLedger } from "./adapters/ledger.ts";
import { dashboard } from "./commands/dashboard.ts";
import { importForge } from "./commands/import.ts";
import { ingest } from "./commands/ingest.ts";
import { query } from "./commands/query.ts";
import { report } from "./commands/report.ts";
import { repositoryOf } from "./domain/forge.ts";

const HELP = `Usage: ledger <command> [options]

Commands:
  ingest [--db <file or URL>] [--prices <file>] <file or folder>...  Read LiteLLM spend log rows, OTLP/JSON runs and CloudEvents (.json, .jsonl) into the database --db.
  report [--db <file or URL>] [--prices <file>] [--since <date>] [--until <date>] [--target <usd>] [--compute-usd-per-hour <usd>] [--platform-usd <usd>] [--out <file>] [--markdown <file>] [--html <file>] [<file or folder>...]
         Ingest the files named, then write cost per pull request, spend, throughput, cycle time, runs and revert rate to --out ($OUTPUT/report.json), as Markdown to --markdown and as a dashboard page to --html.
  query [--db <file or URL>] <SQL>  Run one SQL statement, like "SELECT * FROM pr_cost", and print its rows as JSON Lines.
  dashboard [--out <file>]  Write the Grafana dashboard over the PostgreSQL views to --out ($OUTPUT/ledger-dashboard.json).
  import [--forge github|forgejo] [--since <date>] [--out <file>] <repository URL>
         Read the pull requests, reviews and comments of a GitHub or Forgejo repository and write them as pr.* events to --out ($OUTPUT/pr-events.jsonl).

--db is a DuckDB file or a postgres:// URL; its default is $LEDGER_DB, else ledger.duckdb.
--prices is a LiteLLM price table (model_prices_and_context_window.json): runs without their own cost cost their tokens.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    db: { type: "string", default: process.env.LEDGER_DB || "ledger.duckdb" },
    out: { type: "string" },
    markdown: { type: "string" },
    html: { type: "string" },
    prices: { type: "string" },
    since: { type: "string" },
    until: { type: "string" },
    target: { type: "string" },
    "compute-usd-per-hour": { type: "string", default: "0" },
    "platform-usd": { type: "string", default: "0" },
    forge: { type: "string" },
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
  const output = (file: string) => outputPath(file, values.out);
  if (command === "dashboard") return [dashboard(output("ledger-dashboard.json"))];
  if (command === "import") {
    check(paths.length === 1, "import takes one repository URL like https://github.com/acme/web");
    const repository = repositoryOf(paths[0] as string, values.forge, process.env.LEDGER_FORGE_URL);
    const token = process.env.LEDGER_FORGE_TOKEN || undefined;
    return [await importForge(repository, { token, since: options.since, out: output("pr-events.jsonl") })];
  }
  const ledger = await openLedger(values.db);
  try {
    if (command === "ingest") return await ingest(ledger, paths, values.prices);
    if (command === "query") return await query(ledger, paths.join(" "));
    const ingested = paths.length ? await ingest(ledger, paths, values.prices) : [];
    const files = { out: output("report.json"), markdown: values.markdown, html: values.html };
    return [...ingested, ...(await report(ledger, options, files))];
  } finally {
    await ledger.close();
  }
}

const known = ["ingest", "report", "query", "dashboard", "import"].includes(command as string);
const run = async () => ({ lines: await main() });
process.exitCode = await runProgram({
  name: "ledger",
  usage: HELP,
  command: known ? run : undefined,
  help: values.help,
});
