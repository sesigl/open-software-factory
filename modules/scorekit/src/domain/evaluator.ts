// A scorer as a Langfuse LLM-as-a-judge evaluator and its evaluation rule (ADR 0033).
import { judgeInstructions } from "./judge.ts";
import type { Scorer } from "./scorer.ts";

export interface ModelConfig {
  provider: string;
  model: string;
}

/** Langfuse's create-evaluator request for an LLM-as-a-judge evaluator. */
export interface Evaluator {
  name: string;
  description: string | null;
  type: "llm_as_judge";
  prompt: { role: "system" | "user"; content: string }[];
  modelConfig: ModelConfig | null;
  variableMapping: { variable: string; source: string }[];
  outputDefinition: { dataType: "BOOLEAN"; scoreValueInstructions: string; scoreReasoningInstructions: string };
}

/** Langfuse's create-rule request without its evaluator. */
export interface Rule {
  name: string;
  enabled: boolean;
  sampling: number;
  filter: { type: "stringOptions"; column: "name"; operator: "any of"; value: string[] }[];
}

/** The name of a run's root observation (ADR 0023). */
const ROOT = "invoke_agent";

export function evaluatorOf(scorer: Scorer, modelConfig: ModelConfig | null): Evaluator {
  return {
    name: scorer.name,
    description: scorer.description || null,
    type: "llm_as_judge",
    prompt: [
      { role: "system", content: judgeInstructions(scorer) },
      { role: "user", content: "The session's input:\n{{input}}\n\nThe session's output:\n{{output}}" },
    ],
    modelConfig,
    variableMapping: [
      { variable: "input", source: "input" },
      { variable: "output", source: "output" },
    ],
    outputDefinition: {
      dataType: "BOOLEAN",
      scoreValueInstructions: `true when the session passes, false when it fails. Pass criterion: ${scorer.pass}`,
      scoreReasoningInstructions: "One or two sentences on why the session passes or fails.",
    },
  };
}

export function ruleOf(scorer: Scorer, enabled: boolean): Rule {
  return {
    name: `scorekit ${scorer.name}`,
    enabled,
    sampling: scorer.sample,
    filter: [{ type: "stringOptions", column: "name", operator: "any of", value: [ROOT] }],
  };
}

/** Whether an evaluator Langfuse holds has the wanted description, prompt, output definition and model. */
export function sameDefinition(wanted: Evaluator, held: Record<string, unknown>): boolean {
  const output = (held.outputDefinition ?? {}) as Record<string, unknown>;
  const prompt = Array.isArray(held.prompt) ? (held.prompt as Record<string, unknown>[]) : [];
  const model = held.modelConfig as Record<string, unknown> | null | undefined;
  return (
    held.type === wanted.type &&
    (held.description ?? null) === wanted.description &&
    prompt.length === wanted.prompt.length &&
    wanted.prompt.every(
      (message, index) => prompt[index]?.role === message.role && prompt[index]?.content === message.content,
    ) &&
    (model
      ? model.provider === wanted.modelConfig?.provider && model.model === wanted.modelConfig?.model
      : wanted.modelConfig === null) &&
    Object.entries(wanted.outputDefinition).every(([key, value]) => output[key] === value)
  );
}
