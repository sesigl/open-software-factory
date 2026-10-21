// scorekit push: send score records to Langfuse.
import { readScores } from "../adapters/files.ts";
import { pushScore } from "../adapters/langfuse.ts";
import { UsageError } from "../domain/errors.ts";

export async function push(paths: string[], env: NodeJS.ProcessEnv) {
  const { LANGFUSE_PUBLIC_KEY: publicKey, LANGFUSE_SECRET_KEY: secretKey } = env;
  if (!publicKey || !secretKey) throw new UsageError("set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY");
  const langfuse = { host: env.LANGFUSE_HOST || "https://cloud.langfuse.com", publicKey, secretKey };
  const scores = readScores(paths);
  const errors: string[] = [];
  for (const score of scores) {
    const problem = await pushScore(langfuse, score);
    if (problem) errors.push(`score ${score.id}: ${problem}`);
  }
  return { lines: [`pushed ${scores.length - errors.length} of ${scores.length} scores to Langfuse`], errors };
}
