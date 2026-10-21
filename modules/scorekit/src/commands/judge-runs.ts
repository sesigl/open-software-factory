// Asks the judge about runs one after another. A failed call or an answer without a verdict is reported and skipped.

import { UsageError } from "@opensoftware/cli";
import { askJudge, JudgeError } from "../adapters/judge.ts";
import { judgeCost, judgeMessages, parseVerdict, type Verdict } from "../domain/judge.ts";
import type { Run } from "../domain/runs.ts";
import type { Scorer } from "../domain/scorer.ts";
import { transcript } from "../domain/transcript.ts";

export interface Gateway {
  url: string;
  key?: string;
}

export interface Judgement {
  run: Run;
  verdict: Verdict;
  model: string;
  cost?: number;
}

export function gatewayFrom(env: NodeJS.ProcessEnv): Gateway {
  const url = env.SCOREKIT_INFERENCE_URL;
  if (!url) throw new UsageError("set SCOREKIT_INFERENCE_URL to the base URL of an OpenAI-compatible gateway");
  return { url, key: env.SCOREKIT_INFERENCE_KEY || undefined };
}

export async function judgeRuns(
  gateway: Gateway,
  scorer: Scorer,
  runs: Run[],
  onJudged: (judgement: Judgement) => void,
): Promise<string[]> {
  const errors: string[] = [];
  for (const run of runs) {
    try {
      const answer = await askJudge(gateway, scorer.model, judgeMessages(scorer, transcript(run, scorer.maxChars)));
      const verdict = parseVerdict(answer.text);
      if (!verdict) {
        errors.push(`${run.id}: the judge's answer is not a verdict: ${answer.text.slice(0, 200)}`);
        continue;
      }
      onJudged({ run, verdict, model: answer.model, cost: judgeCost(scorer, answer.usage) });
    } catch (error) {
      if (!(error instanceof JudgeError)) throw error;
      errors.push(`${run.id}: ${error.message}`);
    }
  }
  return errors;
}
