// The fakes a system test controls instead of real outside systems.
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { StartedTestContainer } from "testcontainers";
import { listFiles, repoRoot } from "../support/module.ts";
import { type Collector, startCollector } from "./collector.ts";
import { type Forge, startForge } from "./forge.ts";
import { type Harness, type HarnessTurn, startHarness } from "./harness.ts";
import { type FakeHttp, type HttpOptions, type HttpRoute, startHttp } from "./http.ts";
import { type ModelGateway, type ScriptedReply, startModelGateway } from "./model-gateway.ts";
import { type Postgres, startPostgres } from "./postgres.ts";
import { type Nats, type S3, startNats, startS3, startTemporal, type Temporal } from "./services.ts";
import { type FakeSlack, startSlack } from "./slack.ts";

export interface Fakes {
  /** A fixture file from the module's `system-tests/fixtures/` folder. */
  fixture(name: string): string;
  /** A read-only copy of a folder of this repository, for example `modules/_template`. */
  fromRepository(dir: string): Record<string, string>;
  /** Starts a scripted model gateway. An unscripted call fails the scenario with the request shown. */
  modelGateway(script: ScriptedReply[]): Promise<ModelGateway>;
  /** Starts a scripted JSON API. A request no route names fails the scenario with the request shown. */
  http(routes: HttpRoute[], options?: HttpOptions): Promise<FakeHttp>;
  /** A scripted coding agent that speaks ACP on stdio. A prompt no turn matches fails the scenario. */
  harness(script: HarnessTurn[]): Promise<Harness>;
  /** PostgreSQL in a container. */
  postgres(): Promise<Postgres>;
  /** NATS with JetStream in a container. */
  nats(): Promise<Nats>;
  /** A Temporal dev server in a container. */
  temporal(): Promise<Temporal>;
  /** An S3 API (SeaweedFS) in a container. */
  s3(): Promise<S3>;
  /** A Forgejo forge in a container, with a user and an API token. */
  forge(): Promise<Forge>;
  /** A fake of the Slack Web API. An unsupported method fails the scenario. */
  slack(): Promise<FakeSlack>;
  /** The OpenTelemetry Collector in a container, running `config`; it exports to OTEL_EXPORTER_OTLP_ENDPOINT. */
  collector(config: string): Promise<Collector>;
}

export interface FakesHandle {
  fakes: Fakes;
  /** The hosts of the running containers; the module may connect to them (NOREAL). */
  hosts(): string[];
  /** Stops every fake and returns what went wrong, such as unscripted calls. */
  close(): Promise<string[]>;
}

export function makeFakes(moduleRoot: string): FakesHandle {
  const stops: (() => Promise<string[]>)[] = [];
  const hosts = new Set<string>();
  const track = (container: StartedTestContainer): StartedTestContainer => {
    hosts.add(container.getHost());
    stops.push(async () => {
      await container.stop();
      return [];
    });
    return container;
  };
  const inProcess = async <T>(started: Promise<{ close(): Promise<string[]> } & T>): Promise<T> => {
    const fake = await started;
    stops.push(() => fake.close());
    return fake;
  };
  return {
    fakes: {
      fixture(name) {
        return readFileSync(join(moduleRoot, "system-tests", "fixtures", name), "utf8");
      },
      fromRepository(dir) {
        const root = join(repoRoot(), dir);
        const tree: Record<string, string> = {};
        for (const file of listFiles(root)) tree[relative(root, file)] = readFileSync(file, "utf8");
        return tree;
      },
      async modelGateway(script) {
        return (await inProcess(startModelGateway(script))).gateway;
      },
      async http(routes, options) {
        return (await inProcess(startHttp(routes, options))).http;
      },
      async harness(script) {
        return (await inProcess(Promise.resolve(startHarness(script)))).harness;
      },
      async postgres() {
        return (await inProcess(startPostgres())).postgres;
      },
      nats: () => startNats(track),
      temporal: () => startTemporal(track),
      s3: () => startS3(track),
      forge: () => startForge(track),
      async slack() {
        return (await inProcess(startSlack())).slack;
      },
      async collector(config) {
        return (await inProcess(startCollector(config, track))).collector;
      },
    },
    hosts: () => [...hosts],
    async close() {
      return (await Promise.all(stops.splice(0).map((stop) => stop()))).flat();
    },
  };
}
