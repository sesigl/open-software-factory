// The cost of a run from its token usage and a LiteLLM price table, model_prices_and_context_window.json (ADR 0044).
import { check } from "@opensoftware/cli";
import type { RunRow } from "./records.ts";

/**
 * Gives each run with token usage and without its own cost the cost of its tokens at its model's prices. Cached
 * tokens of a model without cache prices cost the input price. Returns one line for each model the table lacks.
 */
export function priceRuns(runs: RunRow[], table: unknown, file: string): string[] {
  check(
    typeof table === "object" && table !== null && !Array.isArray(table),
    `${file}: not a LiteLLM price table: an object with one entry per model`,
  );
  const missing = new Map<string, number>();
  for (const run of runs) {
    if (run.costUsd !== null || !run.usage) continue;
    const model = run.model ?? "";
    const entry = (table as Record<string, Record<string, unknown> | undefined>)[model];
    if (!entry) {
      missing.set(model, (missing.get(model) ?? 0) + 1);
      continue;
    }
    const price = (key: string, fallback?: number): number => {
      const value = entry[key] ?? fallback;
      check(typeof value === "number", `${file}: the price "${key}" of the model "${model}" is no number`);
      return value as number;
    };
    const input = price("input_cost_per_token");
    const { usage } = run;
    run.costUsd =
      (usage.input - usage.cacheRead - usage.cacheWrite) * input +
      usage.cacheRead * price("cache_read_input_token_cost", input) +
      usage.cacheWrite * price("cache_creation_input_token_cost", input) +
      usage.output * price("output_cost_per_token");
  }
  return [...missing].map(
    ([model, count]) =>
      `no price in ${file} for the model "${model}": ${count} ${count === 1 ? "run" : "runs"} without cost`,
  );
}
