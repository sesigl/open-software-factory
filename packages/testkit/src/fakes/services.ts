// Real services in containers (ADR 0016); Temporal and NATS run on the host instead (binaries.ts, ADR 0067).
// Each helper starts one container for the scenario; the test gets only
// what a module needs to reach it, never a client for the module's data.
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

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
  s3: "chrislusf/seaweedfs:3.97",
  forge: "code.forgejo.org/forgejo/forgejo:11",
  collector: "otel/opentelemetry-collector-contrib:0.148.0",
} as const;

export type Track = (container: StartedTestContainer) => StartedTestContainer;

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
