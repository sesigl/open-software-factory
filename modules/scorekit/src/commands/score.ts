// scorekit score: judge each sampled run that has no score of the scorer yet and append its score.
import { appendScore, readRunFiles, readScorer, readScores } from "../adapters/files.ts";
import { UsageError } from "../domain/errors.ts";
import { round } from "../domain/judge.ts";
import { parseRuns } from "../domain/runs.ts";
import { isSampled } from "../domain/sample.ts";
import { runOf, scoreOf } from "../domain/score.ts";
import { gatewayFrom, judgeRuns } from "./judge-runs.ts";

export interface ScoreOptions {
  scorer?: string;
  seed: string;
  sample?: string;
  out: string;
  now: string;
}

export async function score(paths: string[], options: ScoreOptions, env: NodeJS.ProcessEnv) {
  const scorer = readScorer(options.scorer);
  const rate = options.sample === undefined ? scorer.sample : Number(options.sample);
  if (!(rate >= 0 && rate <= 1)) throw new UsageError("--sample must be a number from 0 to 1");
  const runs = parseRuns(readRunFiles(paths));
  const gateway = gatewayFrom(env);
  const scored = new Set(
    readScores([options.out], { missingOk: true })
      .filter((one) => one.name === scorer.name)
      .map(runOf),
  );
  const chosen = runs.filter((run) => isSampled(options.seed, scorer.name, run.id, rate) && !scored.has(run.id));
  let passes = 0;
  let fails = 0;
  let cost: number | undefined;
  const errors = await judgeRuns(gateway, scorer, chosen, ({ run, verdict, model, cost: one }) => {
    appendScore(options.out, scoreOf(scorer, run, verdict, { model, cost: one, now: options.now }));
    if (verdict.result === "pass") passes += 1;
    else fails += 1;
    if (one !== undefined) cost = round((cost ?? 0) + one);
  });
  const already = runs.filter((run) => scored.has(run.id)).length;
  const lines = [
    `scored ${passes + fails} of ${runs.length} runs with ${scorer.name}: ${passes} pass, ${fails} fail` +
      (already ? `, ${already} already scored` : "") +
      (cost === undefined ? "" : `, cost ${cost} USD`),
  ];
  return { lines, errors };
}
