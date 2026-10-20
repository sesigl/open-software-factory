// RUNS: the run records of this repository's agent sessions in runs/ (ADR 0027). Every line is an OTLP/JSON export
// request whose root span "invoke_agent" matches the run-record contract and carries no content; a change with
// agent commits since OSF_BASE adds or changes a run record.
import type { Context } from "./lib/context.ts";
import { changedFiles, commitMessages } from "./lib/git.ts";
import type { Finding } from "./lib/repo.ts";

const RUNS = "runs/*.jsonl";
/** The content attributes runlog writes only with --include-content. */
const CONTENT = [
  "gen_ai.input.messages",
  "gen_ai.output.messages",
  "gen_ai.system_instructions",
  "gen_ai.tool.call.arguments",
  "gen_ai.tool.call.result",
];
/** A trailer that marks a commit an agent made. */
const AGENT_TRAILER = /^Co-Authored-By:.*\b(Claude|Codex|OpenCode)\b/im;

interface AnyValue {
  stringValue?: string;
  intValue?: number | string;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values?: AnyValue[] };
}
type KeyValues = { key: string; value: AnyValue }[];
interface Span {
  name: string;
  attributes?: KeyValues;
}
interface Request {
  resourceSpans?: { resource?: { attributes?: KeyValues }; scopeSpans?: { spans?: Span[] }[] }[];
}

const value = (any: AnyValue): unknown => {
  if (any.arrayValue) return (any.arrayValue.values ?? []).map(value);
  if (any.intValue !== undefined) return Number(any.intValue);
  return any.stringValue ?? any.doubleValue ?? any.boolValue;
};
const record = (attributes: KeyValues = []): Record<string, unknown> =>
  Object.fromEntries(attributes.map(({ key, value: any }) => [key, value(any)]));

export async function runs(context: Context): Promise<Finding[]> {
  const { repo } = context;
  const findings: Finding[] = [];
  let validate: typeof import("@opensoftware/contracts").validate;
  try {
    ({ validate } = await import("@opensoftware/contracts"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return [{ check: "RUNS", message: `@opensoftware/contracts is not built (run make verify): ${reason}` }];
  }

  for (const file of repo.match(RUNS)) {
    for (const [index, text] of repo.read(file).split("\n").entries()) {
      if (!text.trim()) continue;
      for (const message of problemsOf(text, validate))
        findings.push({ check: "RUNS", file, line: index + 1, message });
    }
  }

  const base = context.base("RUNS");
  if (!base) return findings;
  const agentCommits = commitMessages(repo.root, base).filter((message) => AGENT_TRAILER.test(message));
  const changed = changedFiles(repo.root, base).filter(
    (file) => /^runs\/[^/]+\.jsonl$/.test(file) && repo.exists(file),
  );
  if (agentCommits.length > 0 && changed.length === 0) {
    findings.push({
      check: "RUNS",
      message: `${agentCommits.length} commit(s) since the base were made by an agent, but no run record in runs/ changed: run make run-record and commit runs/`,
    });
  }
  return findings;
}

/** What is wrong with one line of a run record. */
function problemsOf(text: string, validate: typeof import("@opensoftware/contracts").validate): string[] {
  let request: Request;
  try {
    request = JSON.parse(text) as Request;
  } catch {
    return ["is not JSON: write it with make run-record"];
  }
  const groups = (request.resourceSpans ?? []).map((group) => ({
    resource: record(group.resource?.attributes),
    spans: (group.scopeSpans ?? []).flatMap((scope) => scope.spans ?? []),
  }));
  const roots = groups.flatMap(({ resource, spans }) =>
    spans.filter((span) => span.name === "invoke_agent").map((span) => ({ resource, span })),
  );
  const [root] = roots;
  if (!root || roots.length > 1) return [`needs one root span "invoke_agent", found ${roots.length}`];
  const messages: string[] = [];
  const problems = validate("run-record", { resource: root.resource, span: record(root.span.attributes) });
  if (problems.length > 0) {
    const list = problems.map((problem) => `${problem.path} ${problem.message}`).join("; ");
    messages.push(`does not match the run-record contract: ${list}`);
  }
  const keys = groups.flatMap(({ spans }) => spans.flatMap((span) => (span.attributes ?? []).map(({ key }) => key)));
  const content = [...new Set(keys.filter((key) => CONTENT.includes(key)))].sort();
  if (content.length > 0) messages.push(`has content ${content.join(", ")}: export without --include-content`);
  return messages;
}
