// Langfuse's public API with basic auth: the score API (ADR 0032) and the v2 evaluator and evaluation-rule API
// (ADR 0033). Langfuse keeps one score per ID.
import type { Score } from "@opensoftware/contracts";
import { UsageError } from "../domain/errors.ts";
import type { Evaluator, Rule } from "../domain/evaluator.ts";

export interface Langfuse {
  host: string;
  publicKey: string;
  secretKey: string;
}

/** Langfuse from LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY. */
export function langfuseFrom(env: NodeJS.ProcessEnv): Langfuse {
  const { LANGFUSE_PUBLIC_KEY: publicKey, LANGFUSE_SECRET_KEY: secretKey } = env;
  if (!publicKey || !secretKey) throw new UsageError("set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY");
  return { host: env.LANGFUSE_HOST || "https://cloud.langfuse.com", publicKey, secretKey };
}

type Answer = { problem?: string; body?: Record<string, unknown> };

async function call(langfuse: Langfuse, method: string, path: string, body?: unknown): Promise<Answer> {
  const auth = Buffer.from(`${langfuse.publicKey}:${langfuse.secretKey}`).toString("base64");
  const response = await fetch(`${langfuse.host.replace(/\/+$/, "")}${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) return { problem: `Langfuse answered HTTP ${response.status}` };
  return { body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
}

export async function pushScore(langfuse: Langfuse, score: Score): Promise<string | undefined> {
  return (await call(langfuse, "POST", "/api/public/scores", score)).problem;
}

/** Every evaluator of the project, newest first, following the cursor. */
export async function listEvaluators(langfuse: Langfuse): Promise<Record<string, unknown>[]> {
  const evaluators: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  do {
    const query = cursor === undefined ? "" : `&cursor=${encodeURIComponent(cursor)}`;
    const { problem, body } = await call(langfuse, "GET", `/api/public/v2/evaluators?limit=100${query}`);
    if (problem) throw new Error(`listing evaluators: ${problem}`);
    evaluators.push(...((body?.data ?? []) as Record<string, unknown>[]));
    const next = (body?.meta as Record<string, unknown> | undefined)?.cursor;
    cursor = typeof next === "string" && next ? next : undefined;
  } while (cursor !== undefined);
  return evaluators;
}

/** Creates the evaluator; its ID, or the problem. */
export async function createEvaluator(langfuse: Langfuse, evaluator: Evaluator): Promise<Answer> {
  return call(langfuse, "POST", "/api/public/v2/evaluators", evaluator);
}

/** Replaces the evaluator's definition, which makes a new version. */
export async function updateEvaluator(langfuse: Langfuse, id: string, evaluator: Evaluator): Promise<Answer> {
  return call(langfuse, "PATCH", `/api/public/v2/evaluators/${encodeURIComponent(id)}`, evaluator);
}

export async function createRule(langfuse: Langfuse, rule: Rule, evaluatorId: string): Promise<Answer> {
  return call(langfuse, "POST", "/api/public/v2/evaluation-rules", {
    ...rule,
    evaluatorAssignments: [{ evaluatorId }],
  });
}
