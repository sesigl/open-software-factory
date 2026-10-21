// The plain-text transcript the judge reads: the run's facts, then each step in time order (ADR 0032).
import type { Run, Span, Value } from "./runs.ts";

export function transcript(run: Run, maxChars: number): string {
  const root = run.root.attributes;
  const facts: [string, Value][] = [
    ["Run", run.id],
    ["Harness", run.resource["osf.harness.name"]],
    ["Stage", run.resource["osf.stage"]],
    ["Model", root["gen_ai.request.model"]],
    ["Outcome", root["osf.outcome"]],
    ["Pull requests", list(root["osf.pull_request.urls"])],
    ["Issues", list(root["osf.issue.urls"])],
    ["Duration", seconds(run.root)],
    ["Tokens", tokens(root)],
  ];
  const head = facts.filter(([, fact]) => fact !== undefined && fact !== "").map(([key, fact]) => `${key}: ${fact}`);
  const steps = run.spans.flatMap(step);
  const text = [...head, "", "Steps:", ...(steps.length ? steps : ["(none recorded)"])].join("\n");
  return cut(text, maxChars);
}

function step(span: Span): string[] {
  const at = span.attributes;
  if (at["gen_ai.operation.name"] === "execute_tool") {
    const name = at["gen_ai.tool.name"] ?? span.name.replace(/^execute_tool /, "");
    const lines = [`[tool ${name}]${at["gen_ai.tool.call.arguments"] ? ` ${at["gen_ai.tool.call.arguments"]}` : ""}`];
    if (at["gen_ai.tool.call.result"] !== undefined) lines.push(`  result: ${at["gen_ai.tool.call.result"]}`);
    return lines;
  }
  return at["gen_ai.operation.name"] === "chat"
    ? [...messages(at["gen_ai.input.messages"]), ...messages(at["gen_ai.output.messages"])]
    : [];
}

/** GenAI message JSON: [{role, parts: [{type: "text", content}]}], as runlog writes it; other part types are left out. */
function messages(json: Value): string[] {
  if (typeof json !== "string") return [];
  const list = JSON.parse(json) as { role?: string; parts?: { type?: string; content?: string }[] }[];
  return list.flatMap(({ role, parts = [] }) =>
    parts.filter((part) => part.type === "text" && part.content).map((part) => `[${role}] ${part.content}`),
  );
}

function list(urls: Value): string | undefined {
  return Array.isArray(urls) && urls.length ? urls.join(", ") : undefined;
}

function seconds(span: Span): string | undefined {
  return span.end > span.start ? `${Number((span.end - span.start) / 1_000_000n) / 1000} s` : undefined;
}

function tokens(at: Record<string, Value>): string | undefined {
  const input = at["gen_ai.usage.input_tokens"];
  const output = at["gen_ai.usage.output_tokens"];
  return input === undefined && output === undefined ? undefined : `${input ?? 0} in, ${output ?? 0} out`;
}

/** Keeps the start and the end of a text longer than `max` and puts a marker with the number of cut characters between. */
export function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const marker = (count: number) => `\n[... ${count} characters cut ...]\n`;
  const budget = max - marker(text.length).length;
  const head = Math.ceil(budget / 2);
  const tail = Math.floor(budget / 2);
  return text.slice(0, head) + marker(text.length - head - tail) + text.slice(text.length - tail);
}
