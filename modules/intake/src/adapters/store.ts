// The work items, the requests that asked for them, and the event outbox, in the schema "intake" (ADR 0063).
import type { WorkItem, WorkReceived, WorkRetryRequested } from "@opensoftware/contracts";
import type { After, InboxPage, Request, RunFact, Status, Stored } from "../domain/view.ts";
import { originKey } from "../domain/work-item.ts";
import { openDatabase, type Sql } from "./database.ts";

const TABLES = `
CREATE SCHEMA IF NOT EXISTS intake;
CREATE TABLE IF NOT EXISTS intake.work_items (
  id text PRIMARY KEY,
  item jsonb NOT NULL,
  received_at bigint NOT NULL
);
ALTER TABLE intake.work_items ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received';
ALTER TABLE intake.work_items ADD COLUMN IF NOT EXISTS run_id text;
ALTER TABLE intake.work_items ADD COLUMN IF NOT EXISTS retry_asked text;
CREATE TABLE IF NOT EXISTS intake.requests (
  seq bigserial PRIMARY KEY,
  work_item text NOT NULL REFERENCES intake.work_items (id),
  origin_key text NOT NULL,
  requester jsonb NOT NULL,
  origin jsonb NOT NULL,
  received_at bigint NOT NULL,
  UNIQUE (work_item, origin_key)
);
CREATE TABLE IF NOT EXISTS intake.told (
  event text PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS intake.outbox (
  seq bigserial PRIMARY KEY,
  subject text NOT NULL,
  event jsonb NOT NULL,
  published boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS work_items_latest ON intake.work_items (received_at DESC, id);`;

/** Any number: only one server creates the tables at a time. */
const TABLES_LOCK = 4_716_063;

export interface Outgoing {
  seq: number;
  subject: string;
  event: WorkReceived | WorkRetryRequested;
}

export interface Store {
  /**
   * Keeps the work item unless one with its ID exists, and the request unless its origin is listed: `created` when this
   * call kept the work item, `added` when it kept the request.
   */
  submit(
    workItem: WorkItem,
    at: number,
    event?: { subject: string; event: WorkReceived },
  ): Promise<{ created: boolean; added: boolean }>;
  get(id: string): Promise<Stored | undefined>;
  /**
   * A page of the latest work items' IDs, the one received last first, in the status if one is given, and where the
   * next page starts while more follow (ADR 0115).
   */
  latest(page: InboxPage): Promise<{ ids: string[]; next?: After }>;
  /**
   * Moves the work item to the run's status. An event of the run the work item follows, or of a first run, moves it;
   * "running" only while it is still "received". An event of the run after it, whose `retryOf` is the work item's run,
   * moves the work item to that run from any status (ADR 0105). An event of another run changes nothing.
   */
  followRun(fact: RunFact): Promise<void>;
  /**
   * Puts the event of `retry` for the work item's run in the outbox, in one transaction with the mark that it asked
   * for that run, when the work item is "failed" or "cancelled" and did not ask for its run before.
   */
  askRetry(
    id: string,
    retry: (workItem: WorkItem, runId: string) => { subject: string; event: WorkRetryRequested },
  ): Promise<void>;
  /** Whether the requesters heard of the event with this key, its source and ID (ADR 0113). */
  told(event: string): Promise<boolean>;
  /** Marks that the requesters heard of the event; marking it again changes nothing. */
  tell(event: string): Promise<void>;
  /** The events not yet published, oldest first. */
  unpublished(): Promise<Outgoing[]>;
  published(seqs: number[]): Promise<void>;
  /** Resolves when the database answers a query. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

async function addRequest(sql: Sql, workItem: WorkItem, at: number): Promise<boolean> {
  const { rows } = await sql.query(
    `INSERT INTO intake.requests (work_item, origin_key, requester, origin, received_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (work_item, origin_key) DO NOTHING RETURNING seq`,
    [workItem.id, originKey(workItem.origin), workItem.requester, workItem.origin, at],
  );
  return rows.length === 1;
}

export async function openStore(url: string | undefined, folder: string): Promise<Store> {
  const where = url ? "the database at INTAKE_DATABASE_URL" : `the embedded database in ${folder}`;
  const refused = (error: Error) => Promise.reject(new Error(`cannot open ${where}: ${error.message}`));
  const db = await openDatabase(url, folder).catch(refused);
  await db
    .transaction(async (sql) => {
      await sql.query("SELECT pg_advisory_xact_lock($1)", [TABLES_LOCK]);
      await sql.exec(TABLES);
    })
    .catch(refused);
  return {
    submit: (workItem, at, event) =>
      db.transaction(async (sql) => {
        const { rows } = await sql.query(
          "INSERT INTO intake.work_items (id, item, received_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING RETURNING id",
          [workItem.id, workItem, at],
        );
        const added = await addRequest(sql, workItem, at);
        const created = rows.length === 1;
        if (created && event)
          await sql.query("INSERT INTO intake.outbox (subject, event) VALUES ($1, $2)", [event.subject, event.event]);
        return { created, added };
      }),
    async get(id) {
      const { rows } = await db.query<{ item: WorkItem; status: Status; run_id: string | null; received_at: string }>(
        "SELECT item, status, run_id, received_at FROM intake.work_items WHERE id = $1",
        [id],
      );
      const [row] = rows;
      if (!row) return undefined;
      const requests = await db.query<{ requester: Request["requester"]; origin: Request["origin"]; at: string }>(
        "SELECT requester, origin, received_at AS at FROM intake.requests WHERE work_item = $1 ORDER BY seq",
        [id],
      );
      return {
        workItem: row.item,
        status: row.status,
        ...(row.run_id ? { runId: row.run_id } : {}),
        receivedAt: Number(row.received_at),
        requests: requests.rows.map((request) => ({ ...request, at: Number(request.at) })),
      };
    },
    async latest({ status, limit, after }) {
      // One more row than the page tells whether a next page follows.
      const { rows } = await db.query<{ id: string; received_at: string }>(
        `SELECT id, received_at FROM intake.work_items WHERE ($1::text IS NULL OR status = $1)
           AND ($3::bigint IS NULL OR received_at < $3 OR received_at = $3 AND id > $4)
           ORDER BY received_at DESC, id LIMIT $2`,
        [status ?? null, limit + 1, after?.at ?? null, after?.id ?? null],
      );
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        ids: page.map(({ id }) => id),
        ...(rows.length > limit && last ? { next: { at: Number(last.received_at), id: last.id } } : {}),
      };
    },
    async followRun({ workItemId, runId, status, retryOf }) {
      await db.query(
        `UPDATE intake.work_items SET status = $3, run_id = $2 WHERE id = $1 AND (run_id = $4
           OR (run_id IS NULL OR run_id = $2) AND (status = 'received' OR $3 <> 'running'))`,
        [workItemId, runId, status, retryOf ?? null],
      );
    },
    askRetry: (id, retry) =>
      db.transaction(async (sql) => {
        const { rows } = await sql.query<{ item: WorkItem; run_id: string }>(
          `UPDATE intake.work_items SET retry_asked = run_id WHERE id = $1 AND status IN ('failed', 'cancelled')
             AND retry_asked IS DISTINCT FROM run_id RETURNING item, run_id`,
          [id],
        );
        for (const row of rows) {
          const { subject, event } = retry(row.item, row.run_id);
          await sql.query("INSERT INTO intake.outbox (subject, event) VALUES ($1, $2)", [subject, event]);
        }
      }),
    async told(event) {
      const { rows } = await db.query("SELECT 1 FROM intake.told WHERE event = $1", [event]);
      return rows.length > 0;
    },
    async tell(event) {
      await db.query("INSERT INTO intake.told (event) VALUES ($1) ON CONFLICT (event) DO NOTHING", [event]);
    },
    async unpublished() {
      const { rows } = await db.query<{ seq: string; subject: string; event: Outgoing["event"] }>(
        "SELECT seq, subject, event FROM intake.outbox WHERE NOT published ORDER BY seq",
      );
      return rows.map((row) => ({ ...row, seq: Number(row.seq) }));
    },
    async published(seqs) {
      await db.query("UPDATE intake.outbox SET published = true WHERE seq = ANY($1::bigint[])", [seqs]);
    },
    async ping() {
      await db.query("SELECT 1");
    },
    close: () => db.close(),
  };
}
