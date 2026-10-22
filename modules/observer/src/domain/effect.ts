// The effect of a merged change: the failure rate of a problem's scorer before and after the merge, with a
// two-sided two-proportion z-test.
import { percent } from "./present.ts";
import type { RunInfo, Verdict } from "./problems.ts";

export interface Side {
  runs: number;
  failures: number;
  failureRate: number;
}

export type Outcome = "fell" | "rose" | "no clear change" | "not enough runs";

export interface Effect {
  problem: string;
  mergedAt: string;
  minRuns: number;
  before: Side;
  after: Side;
  pValue: number;
  verdict: Outcome;
}

/** The share of a difference this large that chance alone may give, below which the change counts. */
const ALPHA = 0.05;

/**
 * Splits the verdicts at the merge. A run's time is its start in its run record, else the time of its score.
 */
export function effectOf(
  problem: string,
  verdicts: Verdict[],
  runs: Map<string, RunInfo>,
  mergedAt: string,
  minRuns: number,
): Effect {
  const merge = Date.parse(mergedAt);
  const after = verdicts.filter((verdict) => Date.parse(runs.get(verdict.run)?.start ?? verdict.time) >= merge);
  const before = verdicts.filter((verdict) => !after.includes(verdict));
  const [b, a] = [sideOf(before), sideOf(after)];
  const pValue = twoSided(b, a);
  const verdict: Outcome =
    Math.min(b.runs, a.runs) < minRuns
      ? "not enough runs"
      : pValue >= ALPHA
        ? "no clear change"
        : a.failureRate < b.failureRate
          ? "fell"
          : "rose";
  return { problem, mergedAt: new Date(merge).toISOString(), minRuns, before: b, after: a, pValue, verdict };
}

function sideOf(verdicts: Verdict[]): Side {
  const failures = verdicts.filter((verdict) => verdict.failed).length;
  return { runs: verdicts.length, failures, failureRate: verdicts.length ? failures / verdicts.length : 0 };
}

/** The p-value of the two-sided two-proportion z-test; 1 when the rates cannot differ. */
function twoSided(before: Side, after: Side): number {
  const pooled = (before.failures + after.failures) / (before.runs + after.runs);
  const error = Math.sqrt(pooled * (1 - pooled) * (1 / before.runs + 1 / after.runs));
  if (!error) return 1;
  const z = Math.abs(after.failureRate - before.failureRate) / error;
  return 2 * (1 - normal(z));
}

/** The standard normal distribution function, from erf by Abramowitz and Stegun 7.1.26 (error below 1.5e-7). */
function normal(z: number): number {
  const x = z / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return (1 + (1 - poly * Math.exp(-x * x))) / 2;
}

export const effectLine = ({ problem, before, after, verdict }: Effect): string =>
  `${problem}: ${side(before, "before")}, ${side(after, "after")}: ${verdict}`;

const side = ({ runs, failures, failureRate }: Side, when: string): string =>
  `${percent(failureRate)} ${when} (${failures} of ${runs} runs)`;
