// observer check: the failure rate of a problem's scorer before and after a merged change.
import { readRuns, readScores, writeJson } from "../adapters/files.ts";
import { comment, mergedAt } from "../adapters/forge.ts";
import { effectLine, effectOf } from "../domain/effect.ts";
import type { PullRequestRef } from "../domain/forge-url.ts";
import { verdictsByScorer } from "../domain/problems.ts";

export interface CheckOptions {
  problem: string;
  mergedAt: string | undefined;
  pullRequest: PullRequestRef | undefined;
  token: string | undefined;
  minRuns: number;
  runs: string[];
  comment: boolean;
  out: string;
}

export async function check(paths: string[], options: CheckOptions): Promise<string[]> {
  const verdicts = verdictsByScorer(readScores(paths)).get(options.problem) ?? [];
  const pull = options.pullRequest;
  const merged = pull ? await mergedAt(pull, options.token) : options.mergedAt;
  if (!merged) throw new Error(`the pull request ${pull?.url} is not merged`);
  const effect = effectOf(options.problem, verdicts, readRuns(options.runs), merged, options.minRuns);
  const line = effectLine(effect);
  if (options.comment && pull) await comment(pull, options.token, line);
  writeJson(options.out, { ...effect, pullRequest: pull?.url });
  return [line, `wrote ${options.out}`];
}
