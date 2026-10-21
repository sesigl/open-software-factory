// runlog collector <harness>: write the Collector config of a harness from the pack (ADR 0025).
import { UsageError } from "@opensoftware/cli";
import { COLLECTOR_HARNESSES, writeCollectorConfig } from "../adapters/collector.ts";

/** Writes `$OUTPUT/collector.yaml` for the harness and returns the line to print; an unknown harness exits 2. */
export function collectorConfig(harness: string, output: string): string {
  if (!(COLLECTOR_HARNESSES as readonly string[]).includes(harness)) {
    throw new UsageError(
      `unknown harness ${harness}: use ${COLLECTOR_HARNESSES.slice(0, -1).join(", ")} or ${COLLECTOR_HARNESSES.at(-1)}`,
    );
  }
  return `wrote ${writeCollectorConfig(harness, output)}`;
}
