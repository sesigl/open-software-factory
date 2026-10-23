// The gates of server mode, the button presses and the event outbox in PostgreSQL, schema "gatekeeper" (ADR 0048).
import pg from "pg";
import type { Outgoing } from "../domain/events.ts";
import type { Rules } from "../domain/policy.ts";
import type { GateRecord } from "../domain/record.ts";
import type { GateRequest } from "../domain/request.ts";
import type { StoredGate } from "../domain/stored.ts";

const TABLES = `
CREATE SCHEMA IF NOT EXISTS gatekeeper;
CREATE TABLE IF NOT EXISTS gatekeeper.gates (
  id text PRIMARY KEY,
  request jsonb NOT NULL,
  rules jsonb NOT NULL,
  channel text NOT NULL,
  thread text,
  requested_at bigint NOT NULL,
  state text NOT NULL,
  waiting_for jsonb NOT NULL,
  record jsonb
);
CREATE INDEX IF NOT EXISTS gates_thread ON gatekeeper.gates (channel, thread);
CREATE TABLE IF NOT EXISTS gatekeeper.presses (
  gate text NOT NULL REFERENCES gatekeeper.gates (id) ON DELETE CASCADE,
  ts text NOT NULL,
  author text NOT NULL,
  action text NOT NULL,
  PRIMARY KEY (gate, ts)
);
CREATE TABLE IF NOT EXISTS gatekeeper.outbox (
  seq bigserial PRIMARY KEY,
  subject text NOT NULL,
  event jsonb NOT NULL,
  published_at timestamptz
);`;

/** Any number: only one server creates the tables at a time. */
const SCHEMA_LOCK = 4_715_048;

export interface Press {
  ts: string;
  author: string;
  action: string;
}

/** What one transaction on a gate may do. */
export interface Changes {
  update(row: StoredGate): Promise<void>;
  emit(outgoing: Outgoing): Promise<void>;
}

export interface Store {
  /** Inserts the gate unless one with its ID exists; true when this call inserted it. */
  claim(row: StoredGate, event?: Outgoing): Promise<boolean>;
  get(id: string): Promise<StoredGate | undefined>;
  remove(id: string): Promise<void>;
  byThread(channel: string, thread: string): Promise<StoredGate | undefined>;
  pending(): Promise<string[]>;
  press(gate: string, press: Press): Promise<void>;
  presses(gate: string): Promise<Press[]>;
  /** Runs `work` on the locked gate in one transaction; its changes and events commit together. */
  locked<T>(id: string, work: (row: StoredGate | undefined, changes: Changes) => Promise<T>): Promise<T>;
  /** The events not yet published, oldest first, and a way to mark them published. */
  unpublished(): Promise<{ seq: number; subject: string; event: unknown }[]>;
  published(seqs: number[]): Promise<void>;
  close(): Promise<void>;
}

const fromDb = (row: Record<string, unknown>): StoredGate => ({
  id: row.id as string,
  request: row.request as GateRequest,
  rules: row.rules as Rules,
  channel: row.channel as string,
  thread: row.thread as string | null,
  requestedAt: Number(row.requested_at),
  state: row.state as StoredGate["state"],
  waitingFor: row.waiting_for as string[],
  record: row.record as GateRecord | null,
});

const ROW = "id, request, rules, channel, thread, requested_at, state, waiting_for, record";

export async function openStore(url: string): Promise<Store> {
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  pool.on("error", () => {});
  try {
    await inTransaction(pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_LOCK]);
      await client.query(TABLES);
    });
  } catch (error) {
    await pool.end().catch(() => {});
    throw new Error(`cannot open the database at GATEKEEPER_DATABASE_URL: ${(error as Error).message}`);
  }
  const one = async (sql: string, values: unknown[]): Promise<StoredGate | undefined> => {
    const { rows } = await pool.query(sql, values);
    return rows[0] ? fromDb(rows[0]) : undefined;
  };
  const write = (client: pg.PoolClient) => ({
    async update(row: StoredGate) {
      await client.query(
        "UPDATE gatekeeper.gates SET thread = $2, requested_at = $3, state = $4, waiting_for = $5, record = $6 WHERE id = $1",
        [row.id, row.thread, row.requestedAt, row.state, JSON.stringify(row.waitingFor), row.record],
      );
    },
    async emit({ subject, event }: Outgoing) {
      await client.query("INSERT INTO gatekeeper.outbox (subject, event) VALUES ($1, $2)", [subject, event]);
    },
  });
  return {
    claim: (row, event) =>
      inTransaction(pool, async (client) => {
        const { rowCount } = await client.query(
          `INSERT INTO gatekeeper.gates (${ROW}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.request,
            row.rules,
            row.channel,
            row.thread,
            row.requestedAt,
            row.state,
            JSON.stringify(row.waitingFor),
            row.record,
          ],
        );
        if (rowCount && event) await write(client).emit(event);
        return Boolean(rowCount);
      }),
    get: (id) => one(`SELECT ${ROW} FROM gatekeeper.gates WHERE id = $1`, [id]),
    async remove(id) {
      await pool.query("DELETE FROM gatekeeper.gates WHERE id = $1", [id]);
    },
    byThread: (channel, thread) =>
      one(`SELECT ${ROW} FROM gatekeeper.gates WHERE channel = $1 AND thread = $2`, [channel, thread]),
    async pending() {
      const { rows } = await pool.query(
        "SELECT id FROM gatekeeper.gates WHERE state = 'pending' AND thread IS NOT NULL ORDER BY requested_at",
      );
      return rows.map((row) => row.id as string);
    },
    async press(gate, { ts, author, action }) {
      await pool.query(
        "INSERT INTO gatekeeper.presses (gate, ts, author, action) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [gate, ts, author, action],
      );
    },
    async presses(gate) {
      const { rows } = await pool.query("SELECT ts, author, action FROM gatekeeper.presses WHERE gate = $1", [gate]);
      return rows as Press[];
    },
    locked: (id, work) =>
      inTransaction(pool, async (client) => {
        const { rows } = await client.query(`SELECT ${ROW} FROM gatekeeper.gates WHERE id = $1 FOR UPDATE`, [id]);
        return work(rows[0] ? fromDb(rows[0]) : undefined, write(client));
      }),
    async unpublished() {
      const { rows } = await pool.query(
        "SELECT seq, subject, event FROM gatekeeper.outbox WHERE published_at IS NULL ORDER BY seq",
      );
      return rows.map((row) => ({ seq: Number(row.seq), subject: row.subject as string, event: row.event }));
    },
    async published(seqs) {
      await pool.query("UPDATE gatekeeper.outbox SET published_at = now() WHERE seq = ANY($1)", [seqs]);
    },
    close: () => pool.end(),
  };
}

/** BEGIN, the work, COMMIT; ROLLBACK when the work fails. */
async function inTransaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
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
