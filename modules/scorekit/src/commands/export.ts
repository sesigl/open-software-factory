// scorekit export: the scorers as Langfuse LLM-as-a-judge evaluators with their rules, written to a file or, with
// --push, created or updated in Langfuse (ADR 0033).
import { packNames, readScorer, writeText } from "../adapters/files.ts";
import { createEvaluator, createRule, langfuseFrom, listEvaluators, updateEvaluator } from "../adapters/langfuse.ts";
import { UsageError } from "../domain/errors.ts";
import { evaluatorOf, type ModelConfig, ruleOf, sameDefinition } from "../domain/evaluator.ts";

export interface ExportOptions {
  scorers: string[];
  provider?: string;
  model?: string;
  push: boolean;
  enable: boolean;
  out: string;
}

export async function exportEvaluators(options: ExportOptions, env: NodeJS.ProcessEnv) {
  if ((options.provider === undefined) !== (options.model === undefined))
    throw new UsageError("--provider and --model go together");
  const modelConfig: ModelConfig | null =
    options.provider && options.model ? { provider: options.provider, model: options.model } : null;
  const scorers = (options.scorers.length ? options.scorers : packNames()).map(readScorer);
  const entries = scorers.map((scorer) => ({
    scorer: scorer.name,
    evaluator: evaluatorOf(scorer, modelConfig),
    rule: ruleOf(scorer, options.enable),
  }));
  if (!options.push) {
    const file = entries.map(({ evaluator, rule }) => ({ evaluator, rule }));
    writeText(options.out, `${JSON.stringify(file, null, 2)}\n`);
    return { lines: [`wrote ${entries.length} evaluators to ${options.out}`] };
  }

  const langfuse = langfuseFrom(env);
  const held = await listEvaluators(langfuse);
  const lines: string[] = [];
  const errors: string[] = [];
  for (const { scorer, evaluator, rule } of entries) {
    const match = held.find((one) => one.name === evaluator.name);
    if (match && sameDefinition(evaluator, match)) {
      lines.push(`unchanged ${scorer}`);
      continue;
    }
    if (match) {
      const { problem } = await updateEvaluator(langfuse, String(match.id), evaluator);
      if (problem) errors.push(`evaluator ${scorer}: ${problem}`);
      else lines.push(`updated ${scorer}`);
      continue;
    }
    const { problem, body } = await createEvaluator(langfuse, evaluator);
    if (problem || typeof body?.id !== "string") {
      errors.push(`evaluator ${scorer}: ${problem ?? "Langfuse answered without an evaluator ID"}`);
      continue;
    }
    const ruled = await createRule(langfuse, rule, body.id);
    if (ruled.problem) errors.push(`rule of ${scorer}: ${ruled.problem}`);
    else lines.push(`created ${scorer}`);
  }
  return { lines, errors };
}
