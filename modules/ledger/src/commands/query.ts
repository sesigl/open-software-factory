// ledger query: run one SQL statement on the database and print its rows as JSON Lines (ADR 0035).

import { check } from "@opensoftware/cli";
import type { Ledger } from "../adapters/ledger.ts";

export async function query(ledger: Ledger, statement: string): Promise<string[]> {
  check(statement.trim(), 'name the SQL to run, like ledger query "SELECT * FROM pr_cost"');
  const rows = await ledger.query(statement);
  return rows.map((row) =>
    JSON.stringify(row, (_, value) =>
      typeof value === "bigint" ? Number(value) : value instanceof Date ? value.toISOString() : value,
    ),
  );
}
