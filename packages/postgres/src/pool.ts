// The pool and the transactions of a module on PostgreSQL (ADR 0082).
import pg from "pg";

export interface PoolOptions {
  /** The most clients the pool keeps open at once. */
  max: number;
}

/**
 * A pool on the database at `url`. A client that loses its connection does not end the process: the pool listens for
 * the errors of its idle clients, and each client for its own, also while a transaction holds it between two queries.
 * Its next query fails instead, and the pool destroys it when it is released.
 */
export function openPool(url: string, { max }: PoolOptions): pg.Pool {
  const pool = new pg.Pool({ connectionString: url, max });
  pool.on("error", () => {});
  pool.on("connect", (client) => client.on("error", () => {}));
  return pool;
}

/** BEGIN, the work, COMMIT; ROLLBACK when the work or the COMMIT fails. The client goes back to the pool in any case. */
export async function transaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
