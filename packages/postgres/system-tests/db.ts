// Shared steps of the postgres scenarios: a pool on the database of fakes.postgres() with the table "work", and the
// errors that would end the process.
import { openPool } from "@opensoftware/postgres";
import type { scenario } from "@opensoftware/testkit";

type Fakes = Parameters<Parameters<typeof scenario>[1]>[0]["fakes"];
type Pool = ReturnType<typeof openPool>;

/**
 * A pool on a new database with the table "work", and the errors that would end the process from then on. The pool
 * ends when the scenario ends.
 */
export async function workDatabase(
  fakes: Fakes,
): Promise<{ db: { stop(): Promise<void> }; pool: Pool; errors: Error[] }> {
  const db = await fakes.postgres();
  const pool = openPool(db.url, { max: 2 });
  onTestFinished(() => pool.end().catch(() => {}));
  await pool.query("CREATE TABLE work (id text PRIMARY KEY)");
  return { db, pool, errors: fatalErrors() };
}

/** The ids in "work", in order. */
export async function rows(pool: Pool): Promise<string[]> {
  const { rows: found } = await pool.query<{ id: string }>("SELECT id FROM work ORDER BY id");
  return found.map((row) => row.id);
}

/**
 * Collects what would end the process: an uncaught exception, such as an `error` event without a listener, or an
 * unhandled rejection. It stops collecting when the scenario ends.
 */
function fatalErrors(): Error[] {
  const errors: Error[] = [];
  const keep = (error: unknown) => errors.push(error instanceof Error ? error : new Error(String(error)));
  process.on("uncaughtException", keep);
  process.on("unhandledRejection", keep);
  onTestFinished(() => {
    process.off("uncaughtException", keep);
    process.off("unhandledRejection", keep);
  });
  return errors;
}
