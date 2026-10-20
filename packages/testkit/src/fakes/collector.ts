// The real OpenTelemetry Collector in a container (ADR 0025), running a config a module wrote. The test sends OTLP to
// the config's OTLP/HTTP receiver and reads what the Collector exported to OTEL_EXPORTER_OTLP_ENDPOINT, which the
// fake points at its own receiver on the host.
import { GenericContainer, TestContainers, Wait } from "testcontainers";
import { startHttp } from "./http.ts";
import { address, IMAGES, type Track } from "./services.ts";

export interface Collector {
  /** Posts one OTLP/JSON `ExportTraceServiceRequest` to the config's OTLP/HTTP receiver (port 4318). */
  send(request: unknown): Promise<void>;
  /**
   * Waits until the Collector exported `count` requests (default 1) to OTEL_EXPORTER_OTLP_ENDPOINT and returns every
   * request it exported, in order, as parsed JSON. On timeout (default 10 s) it fails with what arrived.
   */
  exported(options?: { count?: number; timeoutMs?: number }): Promise<unknown[]>;
}

export interface RunningCollector {
  collector: Collector;
  close(): Promise<string[]>;
}

/** The Collector reaches the fake's receiver through the host tunnel of testcontainers. */
const HOST = "host.testcontainers.internal";

export async function startCollector(config: string, track: Track): Promise<RunningCollector> {
  const sink = await startHttp([{ method: "POST", path: "/v1/traces", body: {} }]);
  const port = Number(new URL(sink.http.url).port);
  await TestContainers.exposeHostPorts(port);
  const container = track(
    await new GenericContainer(IMAGES.collector)
      .withEnvironment({ OTEL_EXPORTER_OTLP_ENDPOINT: `http://${HOST}:${port}` })
      .withCopyContentToContainer([{ content: config, target: "/etc/otelcol-contrib/config.yaml" }])
      .withExposedPorts(4318)
      .withWaitStrategy(Wait.forLogMessage(/Everything is ready/))
      .start(),
  );
  const receiver = `http://${address(container, 4318)}`;
  return {
    collector: {
      async send(request) {
        // A refused request exports nothing; exported() then shows the Collector's log.
        await fetch(`${receiver}/v1/traces`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        });
      },
      async exported({ count = 1, timeoutMs = 10_000 } = {}) {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
          const bodies = sink.http.received().map((request) => request.body);
          if (bodies.length >= count) return bodies;
          if (Date.now() > deadline) {
            const logs = await container.logs({ tail: 20 });
            const tail = await new Promise<string>((resolve) => {
              let text = "";
              logs.on("data", (line: Buffer | string) => {
                text += line.toString();
              });
              logs.on("end", () => resolve(text));
              setTimeout(() => resolve(text), 500);
            });
            throw new Error(
              `expected ${count} export(s) from the Collector, got ${bodies.length}. Collector log:\n${tail}`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      },
    },
    close: () => sink.close(),
  };
}
