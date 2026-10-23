// PostgreSQL in the test's process (ADR 0049): PGlite, the PostgreSQL server compiled to WebAssembly, behind a small
// wire-protocol server, so that the module's own driver reaches it over TCP like a real server. No container, no
// Docker. PGlite runs one session; this server lends it to one connection at a time, from the connection's first
// message until PostgreSQL is idle again (ReadyForQuery "I"), so a transaction or an extended-protocol exchange
// never mixes with another connection's messages. It asks for the password like a server with password
// authentication and refuses a wrong one with SQLSTATE 28P01. A new database starts from a copy of an empty data
// directory that the first start of this PGlite version leaves in the temporary folder: 0.6 s instead of 2.4 s.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

export interface Postgres {
  /** `postgres://test:test@127.0.0.1:<port>/test` */
  url: string;
}

const USER = "test";
const PASSWORD = "test";
const SSL_REQUEST = 80877103;
const CANCEL_REQUEST = 80877102;

export async function startPostgres(): Promise<{ postgres: Postgres; close(): Promise<string[]> }> {
  const db = await emptyDatabase();
  const session = new Session(db);
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    new Connection(socket, session).start();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fakes.postgres: the server has no TCP address");
  return {
    postgres: { url: `postgres://${USER}:${PASSWORD}@127.0.0.1:${address.port}/test` },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await session.idle();
      await db.close();
      return [];
    },
  };
}

/** A new PGlite database from the cached empty data directory, made by the first call for this PGlite build. */
async function emptyDatabase(): Promise<PGlite> {
  const build = createHash("sha256")
    .update(fileURLToPath(import.meta.resolve("@electric-sql/pglite")))
    .digest("hex");
  const cache = join(tmpdir(), `osf-testkit-pglite-${build.slice(0, 16)}.tar`);
  if (existsSync(cache)) return PGlite.create({ loadDataDir: new Blob([readFileSync(cache)]) });
  const db = await PGlite.create();
  const dump = await db.dumpDataDir("none");
  const partial = `${cache}.${process.pid}`;
  writeFileSync(partial, Buffer.from(await dump.arrayBuffer()));
  renameSync(partial, cache);
  return db;
}

/** The one PGlite session, lent to one connection at a time. */
class Session {
  private holder: Connection | undefined;
  private waiting: (() => void)[] = [];
  private running = Promise.resolve();
  private readonly db: PGlite;

  constructor(db: PGlite) {
    this.db = db;
  }

  /** Sends one message for `owner`, waiting for the session first; keeps the session while it is not idle. */
  async send(owner: Connection, message: Uint8Array): Promise<Uint8Array> {
    while (this.holder && this.holder !== owner) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.holder = owner;
    const reply = this.db.execProtocolRaw(message);
    this.running = reply.then(
      () => undefined,
      () => undefined,
    );
    const answer = await reply;
    if (readyStatus(answer) === "I") this.release(owner);
    return answer;
  }

  /** Ends what a closed connection left open, then lends the session to the next one. */
  async drop(owner: Connection): Promise<void> {
    if (this.holder !== owner) return;
    await this.running;
    if (this.db.isInTransaction()) await this.db.exec("ROLLBACK");
    this.release(owner);
  }

  idle(): Promise<void> {
    return this.running;
  }

  private release(owner: Connection): void {
    if (this.holder !== owner) return;
    this.holder = undefined;
    for (const wake of this.waiting.splice(0)) wake();
  }
}

/** One client connection: startup, password, then messages passed to the session. */
class Connection {
  private buffer = Buffer.alloc(0);
  private state: "startup" | "password" | "ready" = "startup";
  private startup: Buffer | undefined;
  private user = "";
  private queue = Promise.resolve();
  private readonly socket: Socket;
  private readonly session: Session;

  constructor(socket: Socket, session: Session) {
    this.socket = socket;
    this.session = session;
  }

  start(): void {
    this.socket.setNoDelay(true);
    this.socket.on("data", (data) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this.queue = this.queue
        .then(() => this.drain())
        .catch(() => {
          this.socket.destroy();
        });
    });
    this.socket.on("error", () => undefined);
    this.socket.on("close", () => {
      this.queue = this.queue.then(() => this.session.drop(this));
    });
  }

  private async drain(): Promise<void> {
    for (;;) {
      const message = this.next();
      if (!message) return;
      await this.handle(message);
    }
  }

  /** The next whole message: without a type byte during startup, with one afterwards. */
  private next(): Buffer | undefined {
    const typed = this.state !== "startup";
    const header = typed ? 5 : 4;
    if (this.buffer.length < header) return undefined;
    const length = this.buffer.readInt32BE(typed ? 1 : 0) + (typed ? 1 : 0);
    if (this.buffer.length < length) return undefined;
    const message = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return message;
  }

  private async handle(message: Buffer): Promise<void> {
    if (this.state === "startup") {
      const code = message.readInt32BE(4);
      if (code === SSL_REQUEST) return void this.socket.write("N");
      if (code === CANCEL_REQUEST) return void this.socket.end();
      this.startup = Buffer.from(message);
      this.user = parameters(message.subarray(8)).get("user") ?? "";
      this.state = "password";
      return void this.socket.write(Buffer.from([0x52, 0, 0, 0, 8, 0, 0, 0, 3]));
    }
    if (this.state === "password") {
      const password = message.subarray(5, message.length - 1).toString("utf8");
      if (message[0] !== 0x70 || this.user !== USER || password !== PASSWORD) {
        this.socket.end(failure(`password authentication failed for user "${this.user}"`));
        return;
      }
      this.state = "ready";
      this.socket.write(await this.session.send(this, this.startup as Buffer));
      return;
    }
    if (message[0] === 0x58) return void this.socket.end();
    const answer = await this.session.send(this, message);
    if (this.socket.writable) this.socket.write(answer);
  }
}

/** The transaction status of the last ReadyForQuery in a reply: "I" idle, "T" in a transaction, "E" failed. */
function readyStatus(reply: Uint8Array): string | undefined {
  let status: string | undefined;
  for (let at = 0; at + 5 <= reply.length; ) {
    const length = new DataView(reply.buffer, reply.byteOffset + at + 1, 4).getInt32(0);
    if (reply[at] === 0x5a) status = String.fromCharCode(reply[at + 5] ?? 0);
    at += length + 1;
  }
  return status;
}

/** The name and value pairs of a startup message. */
function parameters(body: Buffer): Map<string, string> {
  const parts = body.toString("utf8").split("\0");
  const out = new Map<string, string>();
  for (let index = 0; index + 1 < parts.length; index += 2)
    if (parts[index]) out.set(parts[index] as string, parts[index + 1] as string);
  return out;
}

/** A fatal ErrorResponse for a refused password. */
function failure(text: string): Buffer {
  const fields = Buffer.from(`SFATAL\0VFATAL\0C28P01\0M${text}\0\0`, "utf8");
  const header = Buffer.alloc(5);
  header[0] = 0x45;
  header.writeInt32BE(fields.length + 4, 1);
  return Buffer.concat([header, fields]);
}
