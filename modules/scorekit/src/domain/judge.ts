// The judge call's messages and the parsing of its verdict (ADR 0032).
import type { Scorer } from "./scorer.ts";

export interface Verdict {
  result: "pass" | "fail";
  reason: string;
}

export interface Message {
  role: "system" | "user";
  content: string;
}

export function judgeMessages(scorer: Scorer, transcript: string): Message[] {
  const system = [
    `You judge one session of a coding agent for the scorer "${scorer.name}".`,
    "",
    scorer.prompt,
    "",
    `Pass criterion: ${scorer.pass}`,
    "",
    'Answer with one JSON object and nothing else: {"result": "pass" or "fail", "reason": "one or two sentences"}.',
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: transcript },
  ];
}

/** The verdict in the judge's answer, or undefined when the answer holds none. */
export function parseVerdict(answer: string): Verdict | undefined {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start < 0 || end < start) return undefined;
  try {
    const { result, reason } = JSON.parse(answer.slice(start, end + 1)) as Record<string, unknown>;
    const verdict = typeof result === "string" ? result.trim().toLowerCase() : "";
    if ((verdict !== "pass" && verdict !== "fail") || typeof reason !== "string" || !reason.trim()) return undefined;
    return { result: verdict, reason: reason.trim() };
  } catch {
    return undefined;
  }
}

/** USD of one call from the token usage and the scorer's price per million tokens. */
export function judgeCost(scorer: Scorer, usage: { input: number; output: number } | undefined): number | undefined {
  if (!scorer.price || !usage) return undefined;
  return round((usage.input * scorer.price.input + usage.output * scorer.price.output) / 1_000_000);
}

export function round(usd: number): number {
  return Math.round(usd * 1e9) / 1e9;
}
