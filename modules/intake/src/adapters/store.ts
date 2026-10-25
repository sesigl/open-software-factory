// The work items, the requests that asked for them, and the event outbox, in the schema "intake" (ADR 0063).
import type { WorkItem, WorkReceived } from "@opensoftware/contracts";
import type { Request, Stored } from "../domain/view.ts";
import { originKey } from "../domain/work-item.ts";
import { openDatabase, type Sql } from "./database.ts";

const TABLES = `
CREATE SCHEMA IF NOT EXISTS intake;
CREATE TABLE IF NOT EXISTS intake.work_items (
  id text PRIMARY KEY,
  item jsonb NOT NULL,
  received_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS intake.requests (
  seq bigserial PRIMARY KEY,
  work_item text NOT NULL REFERENCES intake.work_items (id),
  origin_key text NOT NULL,
  requester jsonb NOT NULL,
  origin jsonb NOT NULL,
  received_at bigint NOT NULL,
  UNIQUE (work_item, origin_key)
);
CREATE TABLE IF NOT EXISTS intake.outbox (
  seq bigserial PRIMARY KEY,
  subject text NOT NULL,
  event jsonb NOT NULL,
  published boolean NOT NULL DEFAULT false
);`;

/** Any number: only one server creates the tables at a time. */
const TABLES_LOCK = 4_716_063;

export interface Outgoing {
  seq: number;
  subject: string;
  event: WorkReceived;
}

export interface Store {
  /** Keeps the work item unless one with its ID exists, and the request; true when this call kept the work item. */
  submit(workItem: WorkItem, at: number, event?: { subject: string; event: WorkReceived }): Promise<boolean>;
  get(id: string): Promise<Stored | undefined>;
  /** The events not yet published, oldest first. */
  unpublished(): Promise<Outgoing[]>;
  published(seqs: number[]): Promise<void>;
  close(): Promise<void>;
}

async function addRequest(sql: Sql, workItem: WorkItem, at: number): Promise<void> {
  await sql.query(
    `INSERT INTO intake.requests (work_item, origin_key, requester, origin, received_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (work_item, origin_key) DO NOTHING`,
    [workItem.id, originKey(workItem.origin), workItem.requester, workItem.origin, at],
  );
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
        await addRequest(sql, workItem, at);
        const created = rows.length === 1;
        if (created && event)
          await sql.query("INSERT INTO intake.outbox (subject, event) VALUES ($1, $2)", [event.subject, event.event]);
        return created;
      }),
    async get(id) {
      const { rows } = await db.query<{ item: WorkItem; received_at: string }>(
        "SELECT item, received_at FROM intake.work_items WHERE id = $1",
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
        receivedAt: Number(row.received_at),
        requests: requests.rows.map((request) => ({ ...request, at: Number(request.at) })),
      };
    },
    async unpublished() {
      const { rows } = await db.query<{ seq: string; subject: string; event: WorkReceived }>(
        "SELECT seq, subject, event FROM intake.outbox WHERE NOT published ORDER BY seq",
      );
      return rows.map((row) => ({ ...row, seq: Number(row.seq) }));
    },
    async published(seqs) {
      await db.query("UPDATE intake.outbox SET published = true WHERE seq = ANY($1::bigint[])", [seqs]);
    },
    close: () => db.close(),
  };
}
