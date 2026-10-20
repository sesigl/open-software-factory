// The native spans a harness sends, as OTLP/JSON, and the Collector the Collector scenarios send them to.
import type { Collector, Fakes, Sut } from "@opensoftware/testkit";
import { runOf, type Span } from "./otlp.ts";

type Value = string | number;

const attributes = (values: Record<string, Value>) =>
  Object.entries(values).map(([key, value]) => ({
    key,
    value: typeof value === "number" ? { intValue: String(value) } : { stringValue: value },
  }));

/** One OTLP/JSON request with one native span of a harness. */
export function nativeSpan(
  name: string,
  values: Record<string, Value> = {},
  resource: Record<string, Value> = {},
): unknown {
  return {
    resourceSpans: [
      {
        resource: { attributes: attributes(resource) },
        scopeSpans: [
          {
            spans: [
              {
                traceId: "5b8e0c7e1d2a4f009a7e0d1f2a3b4c5d",
                spanId: "00f067aa0ba902b7",
                name,
                kind: 1,
                startTimeUnixNano: "1767225600000000000",
                endTimeUnixNano: "1767225660000000000",
                attributes: attributes(values),
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Runs "runlog collector <harness>" and starts the real Collector with the config it wrote. */
export async function collectorFor(sut: Sut, fakes: Fakes, harness: string): Promise<Collector> {
  const run = await sut.cli(["collector", harness]);
  if (run.exitCode !== 0) throw new Error(run.stderr);
  return fakes.collector(await sut.files.read("$OUTPUT/collector.yaml"));
}

/** Sends one request to the Collector and returns the one span it exported. */
export async function exportedSpan(collector: Collector, request: unknown): Promise<Span> {
  await collector.send(request);
  const [exported] = await collector.exported();
  const [span] = runOf(exported).spans;
  if (!span) throw new Error("the Collector exported no span");
  return span;
}
