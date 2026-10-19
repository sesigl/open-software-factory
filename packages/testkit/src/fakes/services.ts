// Real services in containers (ADR 0016). Each helper starts one container for the scenario; the test gets only
// what a module needs to reach it, never a client for the module's data.
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

export interface Postgres {
  /** `postgres://test:test@<host>:<port>/test` */
  url: string;
}

export interface Nats {
  /** `nats://<host>:<port>`, with JetStream. */
  url: string;
}

export interface Temporal {
  /** gRPC address `<host>:<port>` of the frontend service. */
  address: string;
  namespace: string;
  /** Base URL of the HTTP API, for example `${httpUrl}/api/v1/namespaces`. */
  httpUrl: string;
}

export interface S3 {
  /** S3 API endpoint `http://<host>:<port>`; any access key works. */
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const IMAGES = {
  postgres: "postgres:17.6-alpine",
  nats: "nats:2.11.9-alpine",
  temporal: "temporalio/temporal:1.4.1",
  s3: "chrislusf/seaweedfs:3.97",
  forge: "code.forgejo.org/forgejo/forgejo:11",
} as const;

export type Track = (container: StartedTestContainer) => StartedTestContainer;

export async function startPostgres(track: Track): Promise<Postgres> {
  const container = track(
    await new GenericContainer(IMAGES.postgres)
      .withEnvironment({ POSTGRES_USER: "test", POSTGRES_PASSWORD: "test", POSTGRES_DB: "test" })
      .withExposedPorts(5432)
      // The server logs this twice: after initdb, and when it really accepts connections.
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start(),
  );
  return { url: `postgres://test:test@${address(container, 5432)}/test` };
}

export async function startNats(track: Track): Promise<Nats> {
  const container = track(
    await new GenericContainer(IMAGES.nats)
      .withCommand(["-js"])
      .withExposedPorts(4222)
      .withWaitStrategy(Wait.forLogMessage(/Server is ready/))
      .start(),
  );
  return { url: `nats://${address(container, 4222)}` };
}

export async function startTemporal(track: Track): Promise<Temporal> {
  const container = track(
    await new GenericContainer(IMAGES.temporal)
      .withCommand(["server", "start-dev", "--ip", "0.0.0.0", "--http-port", "7243", "--headless"])
      .withExposedPorts(7233, 7243)
      .withWaitStrategy(Wait.forHttp("/api/v1/namespaces", 7243))
      .start(),
  );
  return {
    address: address(container, 7233),
    namespace: "default",
    httpUrl: `http://${address(container, 7243)}`,
  };
}

export async function startS3(track: Track): Promise<S3> {
  const container = track(
    await new GenericContainer(IMAGES.s3)
      .withCommand([
        "server",
        "-s3",
        "-dir=/data",
        "-master.volumeSizeLimitMB=64",
        "-volume.max=4",
        // A single node bootstraps its own Raft cluster instead of waiting about 20 s for an election.
        "-master.raftHashicorp",
        "-master.raftBootstrap",
      ])
      .withExposedPorts(8333)
      .withWaitStrategy(Wait.forHttp("/", 8333))
      .start(),
  );
  return {
    endpoint: `http://${address(container, 8333)}`,
    region: "us-east-1",
    accessKeyId: "test",
    secretAccessKey: "test",
  };
}

export function address(container: StartedTestContainer, port: number): string {
  return `${container.getHost()}:${container.getMappedPort(port)}`;
}
