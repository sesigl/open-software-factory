// The Collector config pack in collector/ of the package (ADR 0025): one OpenTelemetry Collector config per harness.
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The harnesses the pack has a config for. */
export const COLLECTOR_HARNESSES = ["claude-code", "codex", "opencode"] as const;

const PACK = fileURLToPath(new URL("../../collector/", import.meta.url));

/** Copies the config of `harness` to `<output>/collector.yaml` and returns that path. */
export function writeCollectorConfig(harness: string, output: string): string {
  mkdirSync(output, { recursive: true });
  const target = join(output, "collector.yaml");
  copyFileSync(join(PACK, `${harness}.yaml`), target);
  return target;
}
