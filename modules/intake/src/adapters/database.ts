// One SQL interface over PostgreSQL (node-postgres) and the embedded PostgreSQL PGlite (ADR 0063): the server runs
// the same statements on both.
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { dataDir } from "@electric-sql/pglite-prepopulatedfs";
import { openPool, transaction } from "@opensoftware/postgres";
import type pg from "pg";

export interface Sql {
  query<Row>(text: string, values?: unknown[]): Promise<{ rows: Row[] }>;
  /** Several statements without values, such as the tables. */
  exec(text: string): Promise<unknown>;
}

export interface Database extends Sql {
  /** Runs `work` in one transaction: it commits when `work` resolves and rolls back when it throws. */
  transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

async function postgres(url: string): Promise<Database> {
  const pool = openPool(url);
  const sql = (client: pg.Pool | pg.PoolClient): Sql => ({
    query: async <Row>(text: string, values?: unknown[]) =>
      (await client.query(text, values)) as unknown as { rows: Row[] },
    exec: (text) => client.query(text),
  });
  return {
    ...sql(pool),
    transaction: (work) => transaction(pool, (client) => work(sql(client))),
    close: () => pool.end(),
  };
}

/**
 * PGlite in the folder. A new folder starts from PGlite's empty database of the same version (ADR 0093), which costs a
 * third of the CPU time of PostgreSQL's initdb; PGlite refuses it for a folder that holds a database.
 */
async function embedded(folder: string): Promise<Database> {
  mkdirSync(folder, { recursive: true });
  // Stryker disable next-line ConditionalExpression,StringLiteral: a new folder also works without the empty database, only slower
  const empty = existsSync(join(folder, "PG_VERSION")) ? undefined : await dataDir();
  // Stryker disable next-line ObjectLiteral: the same, PGlite then runs initdb itself
  const db = await PGlite.create(folder, { loadDataDir: empty });
  return {
    query: (text, values) => db.query(text, values),
    exec: (text) => db.exec(text),
    transaction: (work) => db.transaction((tx) => work({ query: (t, v) => tx.query(t, v), exec: (t) => tx.exec(t) })),
    close: () => db.close(),
  };
}

/** PostgreSQL at the URL, else PGlite in the folder. */
export async function openDatabase(url: string | undefined, folder: string): Promise<Database> {
  return url ? postgres(url) : embedded(resolve(folder));
}
