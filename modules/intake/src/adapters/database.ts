// One SQL interface over PostgreSQL (node-postgres) and the embedded PostgreSQL PGlite (ADR 0063): the server runs
// the same statements on both.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

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
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  pool.on("error", () => {});
  const sql = (client: pg.Pool | pg.PoolClient): Sql => ({
    query: async <Row>(text: string, values?: unknown[]) =>
      (await client.query(text, values)) as unknown as { rows: Row[] },
    exec: (text) => client.query(text),
  });
  return {
    ...sql(pool),
    async transaction(work) {
      const client = await pool.connect();
      const done = client
        .query("BEGIN")
        .then(() => work(sql(client)))
        .then((result) => client.query("COMMIT").then(() => result));
      // A failed transaction ends its connection, and PostgreSQL rolls back what a closed connection left open.
      void Promise.allSettled([done]).then(([outcome]) => client.release(outcome?.status === "rejected"));
      return done;
    },
    close: () => pool.end(),
  };
}

async function embedded(folder: string): Promise<Database> {
  mkdirSync(folder, { recursive: true });
  const db = await PGlite.create(folder);
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
