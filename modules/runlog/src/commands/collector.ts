// runlog collector <harness>: write the Collector config of a harness from the pack (ADR 0025).
import { COLLECTOR_HARNESSES, writeCollectorConfig } from "../adapters/collector.ts";

/** Thrown for a harness the pack has no config for; the CLI exits with code 2. */
export class UnknownHarness extends Error {}

/** Writes `$OUTPUT/collector.yaml` for the harness and returns the line to print. */
export function collectorConfig(harness: string, output: string): string {
  if (!(COLLECTOR_HARNESSES as readonly string[]).includes(harness)) {
    throw new UnknownHarness(
      `unknown harness ${harness}: use ${COLLECTOR_HARNESSES.slice(0, -1).join(", ")} or ${COLLECTOR_HARNESSES.at(-1)}`,
    );
  }
  return `wrote ${writeCollectorConfig(harness, output)}`;
}
