// @ts-nocheck
// Cost and scores of the factory's runs (ADR 0123): the run records and scores the improvement jobs wrote.
import { runSpans, type Score } from "@opensoftware/contracts";

/** One stage of a run, from its run record's invoke_agent span. */
export interface StageCost {
  run: string;
  stage: string;
  outcome: string;
  usd: number;
}

/** One scorer's scored runs, passes and judge cost. */
export interface ScorerSummary {
  name: string;
  scored: number;
  passed: number;
  usd: number;
}

export interface Improvement {
  stages: StageCost[];
  scorers: ScorerSummary[];
}

/** The stages and scorers of these records: run records give stages, scores give scorers (a score of 1 passed), other
 * records are skipped. */
export function improvementOf(records: unknown[]): Improvement {
  const stages: StageCost[] = [];
  const scorers = new Map<string, ScorerSummary>();
  for (const record of records) {
    const spans = runSpans(record);
    if (spans) {
      for (const span of spans.filter((each) => each.name === "invoke_agent"))
        stages.push({
          run: String(span.resource["osf.run.id"]),
          stage: String(span.resource["osf.stage"]),
          outcome: String(span.attributes["osf.outcome"]),
          usd: Number(span.attributes["osf.cost.usd"] ?? 0),
        });
      continue;
    }
    const score = record as Score;
    if (!score.metadata) continue;
    const summary = scorers.get(score.name) ?? { name: score.name, scored: 0, passed: 0, usd: 0 };
    summary.scored += 1;
    if (score.value === 1) summary.passed += 1;
    summary.usd += score.metadata["osf.judge.cost.usd"] ?? 0;
    scorers.set(score.name, summary);
  }
  return { stages, scorers: [...scorers.values()] };
}

/** An amount like "0.75 USD". */
export const usd = (amount: number) => `${amount.toFixed(2)} USD`;
