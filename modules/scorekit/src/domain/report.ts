// The sum of score files per scorer: pass rate, cost, the pass rate per day and each scored run (ADR 0032).
import type { Score } from "@opensoftware/contracts";
import { percent } from "./calibration.ts";
import { round } from "./judge.ts";
import { costOf, runOf } from "./score.ts";

export interface ScorerReport {
  name: string;
  scored: number;
  passes: number;
  fails: number;
  passRate: number;
  costUsd: number;
  days: { date: string; scored: number; passes: number; passRate: number }[];
  runs: { run: string; traceId: string; result: "pass" | "fail"; reason: string; timestamp: string; costUsd: number }[];
}

export function report(scores: Score[]): { scorers: ScorerReport[] } {
  const judged = scores.filter((score) => score.source !== "ANNOTATION");
  const names = [...new Set(judged.map((score) => score.name))].sort();
  return {
    scorers: names.map((name) => {
      const own = judged.filter((score) => score.name === name).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const passes = own.filter((score) => Number(score.value) === 1).length;
      const dates = [...new Set(own.map(dayOf))];
      return {
        name,
        scored: own.length,
        passes,
        fails: own.length - passes,
        passRate: rate(passes, own.length),
        costUsd: round(own.reduce((sum, score) => sum + costOf(score), 0)),
        days: dates.map((date) => {
          const day = own.filter((score) => dayOf(score) === date);
          const dayPasses = day.filter((score) => Number(score.value) === 1).length;
          return { date, scored: day.length, passes: dayPasses, passRate: rate(dayPasses, day.length) };
        }),
        runs: own.map((score) => ({
          run: runOf(score),
          traceId: score.traceId,
          result: Number(score.value) === 1 ? ("pass" as const) : ("fail" as const),
          reason: score.comment ?? "",
          timestamp: score.timestamp,
          costUsd: costOf(score),
        })),
      };
    }),
  };
}

export function markdown({ scorers }: { scorers: ScorerReport[] }): string {
  const cell = (text: string | number) => String(text).replaceAll("|", "\\|").replaceAll("\n", " ");
  const row = (cells: (string | number)[]) => `| ${cells.map(cell).join(" | ")} |`;
  const lines = [
    "# Scores",
    "",
    row(["Scorer", "Runs", "Pass", "Fail", "Pass rate", "Cost (USD)"]),
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...scorers.map((one) =>
      row([one.name, one.scored, one.passes, one.fails, percent(one.passRate), one.costUsd.toFixed(4)]),
    ),
  ];
  for (const one of scorers) {
    lines.push("", `## ${one.name}`, "", row(["Day", "Runs", "Pass rate"]), "| --- | ---: | ---: |");
    lines.push(...one.days.map((day) => row([day.date, day.scored, percent(day.passRate)])));
    lines.push("", row(["Run", "Result", "Reason", "Time", "Cost (USD)"]), "| --- | --- | --- | --- | ---: |");
    lines.push(...one.runs.map((run) => row([run.run, run.result, run.reason, run.timestamp, run.costUsd.toFixed(4)])));
  }
  return `${lines.join("\n")}\n`;
}

const dayOf = (score: Score): string => new Date(score.timestamp).toISOString().slice(0, 10);
const rate = (part: number, whole: number): number => (whole ? Math.round((part / whole) * 1e6) / 1e6 : 0);
