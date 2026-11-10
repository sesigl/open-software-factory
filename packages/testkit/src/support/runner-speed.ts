// The speed of the machine that runs a package's system tests, for BUDGET (ADR 0103). The benchmark is a fixed load of
// the kind the tests make: Node processes that start and end, and JavaScript that builds, writes and reads objects.
import { spawnSync } from "node:child_process";

/**
 * The benchmark's time on the reference runner, GitHub's `ubuntu-24.04` for public repositories, as the median of the
 * test jobs of one CI run. Change it with the benchmark: BUDGET's budgets are times on that runner.
 */
export const REFERENCE_MS = 1000;

/** The milliseconds that the benchmark takes on this machine now. */
export function benchmark(): number {
  const start = performance.now();
  for (let i = 0; i < 4; i++) spawnSync(process.execPath, ["-e", "0"], { stdio: "ignore" });
  let rows: unknown[] = Array.from({ length: 20_000 }, (_, i) => ({ id: i, name: `row ${i}`, tags: ["a", "b", i] }));
  for (let i = 0; i < 6; i++) rows = JSON.parse(JSON.stringify(rows)) as unknown[];
  return performance.now() - start;
}
