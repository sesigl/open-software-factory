// A session as the spans of one run (contracts/run-record): the root span "invoke_agent", a "chat" span per model
// response and an "execute_tool" span per tool call, with GenAI attribute names. IDs come from the conversation ID,
// so exporting a session again gives the same trace. A run attached by its launcher joins the launcher's trace.
import { createHash } from "node:crypto";
import type { Message, Session, Usage } from "./session.ts";

export type Attributes = Record<string, string | number | string[]>;

export interface RunSpan {
  spanId: string;
  /** Unset on the root span, unless the run joins the trace of its launcher. */
  parentSpanId?: string;
  name: string;
  /** "client" for calls to the model, "internal" otherwise. */
  kind: "internal" | "client";
  start: string;
  end: string;
  attributes: Attributes;
}

export interface Run {
  traceId: string;
  /** Resource attributes runlog knows from the session. */
  resource: Attributes;
  root: RunSpan;
  spans: RunSpan[];
}

const PULL_REQUEST = /https?:\/\/[^\s"'<>()]+\/pulls?\/\d+/g;
// GitHub, Forgejo and GitLab issues, and Linear issues without the title slug.
const ISSUE = /https?:\/\/[^\s"'<>()]+\/issues\/\d+|https:\/\/linear\.app\/[^\s/"'<>()]+\/issue\/[A-Z][A-Z0-9]*-\d+/g;

const hash = (text: string, length: number): string => createHash("sha256").update(text).digest("hex").slice(0, length);

const usage = ({ input, output, cacheRead, cacheWrite }: Usage): Attributes => ({
  "gen_ai.usage.input_tokens": input,
  "gen_ai.usage.output_tokens": output,
  "gen_ai.usage.cache_read.input_tokens": cacheRead,
  "gen_ai.usage.cache_write.input_tokens": cacheWrite,
});

/** GenAI message JSON: [{role, parts: [{type: "text", content}]}]. */
const messages = (list: Message[]): string =>
  JSON.stringify(list.map(({ role, text }) => ({ role, parts: [{ type: "text", content: text }] })));

export interface RunOptions {
  includeContent: boolean;
  /** The trace to join and the span to put the root span below, from the launcher's TRACEPARENT. */
  parent?: { traceId: string; spanId: string };
  /** How the run ended; any value is checked later against the run-record contract. Default "succeeded". */
  outcome?: string;
  /** Where the Agent Trace record of the run is. */
  agentTraceUri?: string;
}

/** The trace ID of a session that does not join a launcher's trace. */
export const traceIdOf = (session: Session): string => hash(`${session.harness}:${session.conversationId}`, 32);

const linksIn = (session: Session, pattern: RegExp): string[] => [
  ...new Set(session.tools.flatMap((call) => call.result.match(pattern) ?? [])),
];

export function runOf(session: Session, options: RunOptions): Run {
  const { includeContent } = options;
  const traceId = options.parent?.traceId ?? traceIdOf(session);
  const spanId = (key: string): string => hash(`${traceId}:${key}`, 16);
  const content = (attributes: Attributes): Attributes => (includeContent ? attributes : {});
  const provider = { "gen_ai.provider.name": session.provider };
  const root: RunSpan = {
    spanId: spanId("root"),
    ...(options.parent ? { parentSpanId: options.parent.spanId } : {}),
    name: "invoke_agent",
    kind: "internal",
    start: session.start,
    end: session.end,
    attributes: {
      "gen_ai.operation.name": "invoke_agent",
      ...provider,
      "gen_ai.conversation.id": session.conversationId,
      "gen_ai.request.model": session.model,
      ...usage(session.usage),
      "osf.outcome": options.outcome ?? "succeeded",
      "osf.pull_request.urls": linksIn(session, PULL_REQUEST),
      "osf.issue.urls": linksIn(session, ISSUE),
      ...(options.agentTraceUri ? { "osf.agent_trace.uri": options.agentTraceUri } : {}),
    },
  };
  const chats = session.responses.map(
    (response, index): RunSpan => ({
      spanId: spanId(`chat:${index}`),
      parentSpanId: root.spanId,
      name: `chat ${response.model}`,
      kind: "client",
      start: response.start,
      end: response.end,
      attributes: {
        "gen_ai.operation.name": "chat",
        ...provider,
        "gen_ai.request.model": response.model,
        ...(response.id ? { "gen_ai.response.id": response.id } : {}),
        ...usage(response.usage),
        ...content({
          "gen_ai.input.messages": messages(response.input),
          "gen_ai.output.messages": messages(response.output),
        }),
      },
    }),
  );
  const tools = session.tools.map(
    (call): RunSpan => ({
      spanId: spanId(`tool:${call.id}`),
      parentSpanId: root.spanId,
      name: `execute_tool ${call.name}`,
      kind: "internal",
      start: call.start,
      end: call.end,
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": call.name,
        "gen_ai.tool.call.id": call.id,
        ...content({ "gen_ai.tool.call.arguments": call.arguments, "gen_ai.tool.call.result": call.result }),
      },
    }),
  );
  return {
    traceId,
    resource: {
      "service.name": session.harness,
      "osf.harness.name": session.harness,
      ...(session.harnessVersion ? { "osf.harness.version": session.harnessVersion } : {}),
      "osf.run.id": session.conversationId,
      "osf.work_item.id": session.conversationId,
      "osf.requester.kind": "person",
      "osf.source": "cli",
    },
    root,
    spans: [root, ...chats, ...tools],
  };
}
