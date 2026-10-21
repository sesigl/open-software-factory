// Trial results the way Harbor writes them: <job folder>/<trial>/result.json, with only the fields taskcapture reads.

export interface TrialResult {
  task: string;
  model: string;
  /** The verifier's reward; undefined when the trial was not scored. */
  reward?: number;
  costUsd?: number;
  error?: string;
}

export function trialResult(trial: TrialResult): string {
  return `${JSON.stringify({
    task_name: trial.task,
    trial_name: `${trial.task}__${trial.model.replaceAll("/", "-")}`,
    agent_info: { name: "claude-code", version: "2.1.0", model_info: { name: trial.model, provider: null } },
    agent_result: { n_input_tokens: 1000, n_output_tokens: 100, cost_usd: trial.costUsd ?? null },
    verifier_result: trial.reward === undefined ? null : { rewards: { reward: trial.reward } },
    exception_info: trial.error
      ? { exception_type: trial.error, exception_message: "", exception_traceback: "", occurred_at: "2026-01-01T00:00:00Z" }
      : null,
  })}\n`;
}

/** Puts the trials into $INPUT/<job>/<trial>/result.json, next to the job's own result.json. */
export async function putJob(
  sut: { files: { put(path: string, content: string): Promise<void> } },
  job: string,
  trials: TrialResult[],
): Promise<void> {
  await sut.files.put(`$INPUT/${job}/result.json`, `${JSON.stringify({ id: job, n_total_trials: trials.length })}\n`);
  for (const trial of trials)
    await sut.files.put(`$INPUT/${job}/${trial.task}__${trial.model}/result.json`, trialResult(trial));
}

/** gpt-5.6-sol 1.0 at 6.23 USD, glm-5.3-flash 0.9 at 1.99 USD and llama-9-tiny 0.2 at 1.50 USD, one task each. */
export const THREE_MODELS: TrialResult[] = [
  { task: "web-1", model: "gpt-5.6-sol", reward: 1, costUsd: 6.23 },
  { task: "web-1", model: "glm-5.3-flash", reward: 0.9, costUsd: 1.99 },
  { task: "web-1", model: "llama-9-tiny", reward: 0.2, costUsd: 1.5 },
];

// biome-ignore lint/suspicious/noExplicitAny: report.json read back from the module's output
export async function readJson(sut: { files: { read(path: string): Promise<string> } }, path: string): Promise<any> {
  return JSON.parse(await sut.files.read(path));
}
