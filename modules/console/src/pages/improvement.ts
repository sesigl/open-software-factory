// The data of the page "/improvement" (src/web/pages/improvement.astro): cost and scores of the factory's runs, from
// the improvement jobs' files (ADR 0123), in the shell of the new look. The template only reads it.
import type { ShellData } from "@opensoftware/ui";
import type { Improvement } from "../domain/improvement.ts";
import { usd } from "../domain/money.ts";

export interface ImprovementData {
  shell: ShellData;
  /** "<cost> over <count> runs." */
  total: string;
  scorers: { name: string; scored: number; passed: number; rate: string; usd: string }[];
  stages: { run: string; href: string; stage: string; outcome: string; outcomeClass: string; usd: string }[];
}

export function improvementData(shell: ShellData, { stages, scorers }: Improvement): ImprovementData {
  const runs = new Set(stages.map((stage) => stage.run)).size;
  const total = stages.reduce((sum, stage) => sum + stage.usd, 0);
  return {
    shell,
    total: `${usd(total)} over ${runs} runs.`,
    scorers: scorers.map((scorer) => ({
      name: scorer.name,
      scored: scorer.scored,
      passed: scorer.passed,
      rate: `${Math.round((100 * scorer.passed) / scorer.scored)}%`,
      usd: usd(scorer.usd),
    })),
    stages: stages.map((stage) => ({
      run: stage.run,
      href: `/runs/${stage.run}`,
      stage: stage.stage,
      outcome: stage.outcome,
      // A stage's outcome as a state: a shape and a word, like "succeeded" and "failed".
      outcomeClass: `osf-state osf-state-${stage.outcome}`,
      usd: usd(stage.usd),
    })),
  };
}
