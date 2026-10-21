// Agreement of a judge with the labels a person wrote: the share of equal results, Cohen's kappa and the four counts.
import type { Verdict } from "./judge.ts";

export interface Judged {
  run: string;
  label: Verdict["result"];
  verdict: Verdict;
}

export interface Calibration {
  scorer: string;
  labeled: number;
  agreed: number;
  agreement: number;
  /** Cohen's kappa; null when chance alone explains every agreement. */
  kappa: number | null;
  counts: { truePass: number; falsePass: number; trueFail: number; falseFail: number };
  disagreements: { run: string; label: string; result: string; reason: string }[];
  /** Labeled runs that are in no runs file. */
  missing: string[];
}

export function calibrate(scorer: string, judged: Judged[], missing: string[]): Calibration {
  const count = (label: string, result: string) =>
    judged.filter((one) => one.label === label && one.verdict.result === result).length;
  const counts = {
    truePass: count("pass", "pass"),
    falsePass: count("fail", "pass"),
    trueFail: count("fail", "fail"),
    falseFail: count("pass", "fail"),
  };
  const total = judged.length;
  const agreed = counts.truePass + counts.trueFail;
  const agreement = total ? agreed / total : 0;
  const labelPass = (counts.truePass + counts.falseFail) / (total || 1);
  const judgePass = (counts.truePass + counts.falsePass) / (total || 1);
  const chance = labelPass * judgePass + (1 - labelPass) * (1 - judgePass);
  return {
    scorer,
    labeled: total,
    agreed,
    agreement: round(agreement),
    kappa: total && chance < 1 ? round((agreement - chance) / (1 - chance)) : null,
    counts,
    disagreements: judged
      .filter((one) => one.label !== one.verdict.result)
      .map((one) => ({ run: one.run, label: one.label, result: one.verdict.result, reason: one.verdict.reason })),
    missing,
  };
}

export const percent = (share: number): string => `${(share * 100).toFixed(1)}%`;

const round = (value: number): number => Math.round(value * 1e6) / 1e6;
