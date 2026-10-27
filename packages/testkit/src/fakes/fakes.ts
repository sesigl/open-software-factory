// The fakes a system test controls instead of real outside systems.
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { StartedTestContainer } from "testcontainers";
import { listFiles, repoRoot } from "../support/module.ts";
import { startNats, startTemporal } from "./binaries.ts";
import { type Collector, startCollector } from "./collector.ts";
import { type Forge, startForge } from "./forge.ts";
import { type FakeGitHub, startGitHub } from "./github.ts";
import { type Harness, type HarnessOptions, type HarnessTurn, startHarness } from "./harness.ts";
import { type FakeHttp, type HttpOptions, type HttpRoute, startHttp } from "./http.ts";
import { type Inference, type InferenceOptions, startInference } from "./inference.ts";
import { type ModelGateway, type ScriptedReply, startModelGateway } from "./model-gateway.ts";
import { type Postgres, startPostgres } from "./postgres.ts";
import { type Sandbox, type SandboxOptions, startSandbox } from "./sandbox.ts";
import { type FakeSentry, startSentry } from "./sentry.ts";
import { type Nats, type S3, startS3, type Temporal } from "./services.ts";
import { type FakeSlack, type SlackOptions, startSlack } from "./slack.ts";

export interface Fakes {
  /** A fixture file from the module's `system-tests/fixtures/` folder. */
  fixture(name: string): string;
  /** A read-only copy of a folder of this repository, for example `modules/_template`. */
  fromRepository(dir: string): Record<string, string>;
  /** Starts a scripted model gateway. An unscripted call fails the scenario with the request shown. */
  modelGateway(script: ScriptedReply[]): Promise<ModelGateway>;
  /** Starts a scripted JSON API. A request no route names fails the scenario with the request shown. */
  http(routes: HttpRoute[], options?: HttpOptions): Promise<FakeHttp>;
  /**
   * A scripted coding agent that speaks ACP on stdio. A prompt no turn matches fails the scenario, as does a command
   * of a turn that fails. With `containers: true`, a module runs it in a container (ADR 0076).
   */
  harness(script: HarnessTurn[], options?: HarnessOptions): Promise<Harness>;
  /** A sandbox adapter whose sandboxes are folders on the host; it records what the module asked of it (ADR 0068). */
  sandbox(options?: SandboxOptions): Promise<Sandbox>;
  /** An inference adapter that serves no gateway; it records the configs and keys a module asked for (ADR 0070). */
  inference(options?: InferenceOptions): Promise<Inference>;
  /** PostgreSQL in a container. */
  postgres(): Promise<Postgres>;
  /** NATS with JetStream, as a process on the host (ADR 0067). */
  nats(): Promise<Nats>;
  /** The Temporal dev server of the Temporal CLI, as a process on the host with an in-memory database (ADR 0067). */
  temporal(): Promise<Temporal>;
  /** An S3 API (SeaweedFS) in a container. */
  s3(): Promise<S3>;
  /**
   * A Forgejo forge in a container, with a user and an API token. The test process starts one; each scenario gets it
   * without the repositories of the scenarios before (ADR 0064).
   */
  forge(): Promise<Forge>;
  /**
   * An in-process fake of GitHub's REST API with the same interface as `forge()`: the user `tester` and its token,
   * repositories, branches, pull requests, statuses, reviews, branch protection and signed webhooks (ADR 0058), and
   * a person's comments in a pull request's conversation (ADR 0059).
   */
  github(): Promise<FakeGitHub>;
  /**
   * A fake of the Slack Web API. An unsupported method fails the scenario. With `containers: true`, a container
   * reaches it at `containerUrl` (ADR 0076).
   */
  slack(options?: SlackOptions): Promise<FakeSlack>;
  /** A fake of Sentry that sends a webhook a signed alert about an event (ADR 0065). */
  sentry(): Promise<FakeSentry>;
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
      async harness(script, options) {
        return (await inProcess(Promise.resolve(startHarness(script, options)))).harness;
      },
      async sandbox(options) {
        return (await inProcess(Promise.resolve(startSandbox(options)))).sandbox;
      },
      async inference(options) {
        return (await inProcess(Promise.resolve(startInference(options)))).inference;
      },
      async postgres() {
        return (await inProcess(startPostgres())).postgres;
      },
      async nats() {
        return (await inProcess(startNats())).service;
      },
      async temporal() {
        return (await inProcess(startTemporal())).service;
      },
      s3: () => startS3(track),
      forge: () => startForge((container) => hosts.add(container.getHost())),
      async github() {
        return (await inProcess(startGitHub())).github;
      },
      async sentry() {
        return startSentry();
      },
      async slack(options) {
        return (await inProcess(startSlack(options))).slack;
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
