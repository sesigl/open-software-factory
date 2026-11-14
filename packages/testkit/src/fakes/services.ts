// Real services in containers (ADR 0016); Temporal and NATS run on the host instead (binaries.ts, ADR 0067).
// Each helper starts one container for the scenario; the test gets only
// what a module needs to reach it, never a client for the module's data.
import type { StartedTestContainer } from "testcontainers";

export interface Nats {
  /** `nats://<host>:<port>`, with JetStream. */
  url: string;
}

export interface Temporal {
  /** gRPC address `<host>:<port>` of the frontend service. */
  address: string;
  /** The namespace of the scenario: pass it to the module, so that it sees no run of another scenario. */
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
  // The major version of the profile's PostgreSQL (deploy/compose/compose.yaml).
  postgres: "postgres:17-alpine",
  s3: "chrislusf/seaweedfs:3.97",
  forge: "code.forgejo.org/forgejo/forgejo:11",
  collector: "otel/opentelemetry-collector-contrib:0.148.0",
} as const;

export type Track = (container: StartedTestContainer) => StartedTestContainer;

/**
 * The labels of every container of the fakes. OSF_TESTKIT_RUN names the run of a mutant: when the run ends, the
 * mutation runner removes its containers by this label. Ryuk does not: every process of a Stryker run shares one
 * Ryuk, which removes the containers only when the last process ends (ADR 0084).
 */
export function runLabels(): Record<string, string> {
  const run = process.env.OSF_TESTKIT_RUN;
  return run ? { "org.opensoftware.run": run } : {};
}

export async function startS3(track: Track): Promise<S3> {
  // testcontainers loads with the first container a scenario starts: most test processes start none (0.25 s).
  const { GenericContainer, Wait } = await import("testcontainers");
  const container = track(
    await new GenericContainer(IMAGES.s3)
      .withLabels(runLabels())
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
  // "localhost" can resolve to ::1 first, and Rancher Desktop publishes a port on IPv4 only.
  const host = container.getHost() === "localhost" ? "127.0.0.1" : container.getHost();
  return `${host}:${container.getMappedPort(port)}`;
}
