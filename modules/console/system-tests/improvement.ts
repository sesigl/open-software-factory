// Shared records of the improvement scenarios: run records as runlog writes them and scores as scorekit writes them.
import type { Page } from "@opensoftware/testkit";
import { rows } from "./console.ts";

/** A run record as runlog writes it: one invoke_agent span of a stage with its outcome and cost. */
export const runRecord = (run: string, stage: string, outcome: string, cost?: number) => ({
  resourceSpans: [
    {
      resource: {
        attributes: [
          { key: "osf.run.id", value: { stringValue: run } },
          { key: "osf.stage", value: { stringValue: stage } },
        ],
      },
      scopeSpans: [
        {
          spans: [
            {
              traceId: run === "run_a" ? "a".repeat(32) : "b".repeat(32),
              spanId: "1".repeat(16),
              name: "invoke_agent",
              attributes: [
                { key: "osf.outcome", value: { stringValue: outcome } },
                ...(cost === undefined ? [] : [{ key: "osf.cost.usd", value: { doubleValue: cost } }]),
              ],
            },
            { traceId: "c".repeat(32), spanId: "2".repeat(16), name: "chat", attributes: [] },
          ],
        },
      ],
    },
  ],
});

/** A score record as scorekit writes it. */
export const score = (name: string, run: string, value: number, cost?: number) => ({
  id: `${name}-${run}`,
  name,
  value,
  dataType: "BOOLEAN",
  traceId: run === "run_a" ? "a".repeat(32) : "b".repeat(32),
  timestamp: "2026-01-01T00:00:00.000Z",
  metadata: { "osf.run.id": run, ...(cost === undefined ? {} : { "osf.judge.cost.usd": cost }) },
});

/** The rows of the table below the heading: the page has one table below each heading of the second level. */
export const table = (page: Page, heading: string) => {
  const index = page.getAllByRole("heading", { level: 2 }).findIndex((found) => found.text === heading);
  const shown = page.getAllByRole("table")[index];
  return shown ? rows(shown) : [];
};

/** JSON Lines of these records. */
export const lines = (records: object[]) => `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
