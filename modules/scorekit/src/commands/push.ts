// scorekit push: send score records to Langfuse.
import { readScores } from "../adapters/files.ts";
import { langfuseFrom, pushScore } from "../adapters/langfuse.ts";

export async function push(paths: string[], env: NodeJS.ProcessEnv) {
  const langfuse = langfuseFrom(env);
  const scores = readScores(paths);
  const errors: string[] = [];
  for (const score of scores) {
    const problem = await pushScore(langfuse, score);
    if (problem) errors.push(`score ${score.id}: ${problem}`);
  }
  return { lines: [`pushed ${scores.length - errors.length} of ${scores.length} scores to Langfuse`], errors };
}
