// Helpers for the export scenarios: the entries of $OUTPUT/evaluators.json and Langfuse's answers about them. They
// read only what scorekit wrote and build the fake Langfuse's answers from it.

export interface Message {
  role: string;
  content: string;
}

export interface Evaluator {
  name: string;
  description: string | null;
  type: string;
  prompt: Message[];
  modelConfig: { provider: string; model: string } | null;
  variableMapping: { variable: string; source: string }[];
  outputDefinition: {
    dataType: string;
    scoreValueInstructions?: string;
    scoreReasoningInstructions?: string;
  };
}

export interface Rule {
  name: string;
  enabled: boolean;
  sampling: number;
  filter: { type: string; column: string; operator: string; value: string[] }[];
}

export interface Entry {
  evaluator: Evaluator;
  rule: Rule;
}

export const LANGFUSE_KEYS = { LANGFUSE_PUBLIC_KEY: "pk-lf-test", LANGFUSE_SECRET_KEY: "sk-lf-test" };
export const BASIC_AUTH = "Basic cGstbGYtdGVzdDpzay1sZi10ZXN0";
export const LIST = "/api/public/v2/evaluators?limit=100";

/** The entries of $OUTPUT/evaluators.json. */
export async function readEntries(sut: { files: { read(path: string): Promise<string> } }): Promise<Entry[]> {
  return JSON.parse(await sut.files.read("$OUTPUT/evaluators.json")) as Entry[];
}

export function entryOf(entries: Entry[], name: string): Entry {
  const entry = entries.find((one) => one.evaluator.name === name);
  if (!entry) throw new Error(`no evaluator "${name}" in evaluators.json`);
  return entry;
}

/** An evaluator as Langfuse lists it: the created definition with its ID, version and one rule. */
export function listed(evaluator: Evaluator, id: string, changes: Partial<Evaluator> = {}) {
  return {
    ...evaluator,
    ...changes,
    id,
    status: "active",
    variables: ["input", "output"],
    evaluationRuleAssignments: [{ evaluationRuleId: "rule-1" }],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    versionId: `${id}-v1`,
    version: 1,
  };
}

/** A created evaluator as Langfuse answers it. */
export function created(id: string) {
  return { id, type: "llm_as_judge", version: 1, evaluationRuleAssignments: [] };
}
