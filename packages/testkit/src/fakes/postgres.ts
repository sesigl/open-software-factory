// PostgreSQL in a container (ADR 0129): the test process starts one server, and each scenario gets a new, empty
// database in it. The scenario reaches its database through a relay on a port of its own, so that a test can stop
// "its" PostgreSQL while the server keeps running for the next scenario.
import { connect, createServer, type Socket } from "node:net";
import type { StartedTestContainer } from "testcontainers";
import { IMAGES, runLabels } from "./services.ts";

export interface Postgres {
  /** `postgres://test:test@127.0.0.1:<port>/<database>` */
  url: string;
  /** Stops the database while the test runs, as a server that goes away: open connections end, new ones are refused. */
  stop(): Promise<void>;
}

const USER = "test";
const PASSWORD = "test";

/**
 * Started by the first scenario of this process that asks for PostgreSQL; Ryuk stops it when the process ends, or
 * the mutation runner when the run of a mutant ends (runLabels).
 */
let running: Promise<StartedTestContainer> | undefined;
let databases = 0;

/** A new database in the PostgreSQL of this process, started on the first call. */
export async function startPostgres(): Promise<{ postgres: Postgres; close(): Promise<string[]> }> {
  running ??= startServer().catch((error: unknown) => {
    running = undefined;
    throw error;
  });
  const container = await running;
  const database = `scenario_${++databases}`;
  const created = await container.exec(["createdb", "--username", USER, database]);
  if (created.exitCode !== 0) throw new Error(`fakes.postgres could not create ${database}: ${created.output}`);
  const relay = await startRelay(container.getHost(), container.getMappedPort(5432));
  return {
    postgres: { url: `postgres://${USER}:${PASSWORD}@127.0.0.1:${relay.port}/${database}`, stop: relay.close },
    async close() {
      await relay.close();
      return [];
    },
  };
}

async function startServer(): Promise<StartedTestContainer> {
  // testcontainers loads with the first container a scenario starts: most test processes start none (0.25 s).
  const { GenericContainer, Wait } = await import("testcontainers");
  return (
    new GenericContainer(IMAGES.postgres)
      .withLabels(runLabels())
      // "password" asks for the password as text, which a test can send without a PostgreSQL client.
      .withEnvironment({ POSTGRES_USER: USER, POSTGRES_PASSWORD: PASSWORD, POSTGRES_HOST_AUTH_METHOD: "password" })
      // The data lives in memory: nothing of a test run is kept.
      .withTmpFs({ "/var/lib/postgresql/data": "rw" })
      .withExposedPorts(5432)
      // The image starts PostgreSQL once to create the user, and then again for clients.
      .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections", 2))
      .start()
  );
}

/** Passes each connection on 127.0.0.1:<port> to the server, until `close` ends them all and frees the port. */
async function startRelay(host: string, port: number): Promise<{ port: number; close(): Promise<void> }> {
  const sockets = new Set<Socket>();
  const server = createServer((client) => {
    const upstream = connect(port, host);
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on("error", () => undefined);
      socket.on("close", () => sockets.delete(socket));
    }
    client.pipe(upstream).pipe(client);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fakes.postgres: the relay has no TCP address");
  // Once only: a test may stop the database, and the teardown closes it again.
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= new Promise<void>((resolve) => {
      for (const socket of sockets) socket.destroy();
      server.close(() => resolve());
    }));
  return { port: address.port, close };
}
