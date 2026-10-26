// The scripted ACP agent that fakes.harness() starts as a process: node harness-agent.ts <script.json> <log.jsonl>.
// For each prompt it takes the first unused turn whose `when` the prompt contains, asks the client to approve the
// turn's tool calls, applies its edits, streams the reply and ends the turn. A prompt that a waiting turn waits for
// is a steering message: it ends at once and lets that turn go on. The agent also takes a steering message as the
// request `_session/steering`, as codex-acp does (ADR 0053). The agent logs every prompt and tool call so the testkit
// can show the prompts nobody scripted, and each session it opens with the model variables it got (ADR 0070).
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import { type AgentContext, agent, type ContentBlock, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import type { HarnessLogEntry, HarnessTurn } from "./harness.ts";

const [scriptFile, logFile] = process.argv.slice(2) as [string, string];
const script = JSON.parse(readFileSync(scriptFile, "utf8")) as HarnessTurn[];
const used = new Set<number>();

interface Session {
  cwd: string;
  /** The turn that waits for a steering message: the text it waits for and how to wake it. */
  waiting?: { text: string; wake(how: "steered" | "cancelled"): void; ignoresCancel: boolean };
}
const sessions = new Map<string, Session>();
let writesThroughClient = false;
let toolCalls = 0;
const log = (entry: HarnessLogEntry): void => appendFileSync(logFile, `${JSON.stringify(entry)}\n`);

/** Asks the client to approve each tool call of the turn; true when it allowed every one. */
async function approveTools(client: AgentContext, sessionId: string, turn: HarnessTurn): Promise<boolean> {
  let allowed = true;
  for (const tool of turn.tools ?? []) {
    const toolCallId = `tool-${++toolCalls}`;
    await client.notify("session/update", {
      sessionId,
      update: { sessionUpdate: "tool_call", toolCallId, title: tool.title, kind: tool.kind, status: "pending" },
    });
    const { outcome } = await client.request("session/request_permission", {
      sessionId,
      toolCall: { toolCallId, title: tool.title, kind: tool.kind },
      options: [
        { optionId: "allow", name: "Allow", kind: "allow_once" },
        { optionId: "reject", name: "Reject", kind: "reject_once" },
      ],
    });
    const ok = outcome.outcome === "selected" && outcome.optionId === "allow";
    log({ tool: { ...tool, outcome: ok ? "allowed" : "refused" } });
    await client.notify("session/update", {
      sessionId,
      update: { sessionUpdate: "tool_call_update", toolCallId, status: ok ? "completed" : "failed" },
    });
    allowed &&= ok;
  }
  return allowed;
}

const textOf = (prompt: ContentBlock[]): string =>
  prompt.map((block) => (block.type === "text" ? block.text : "")).join("\n");

agent({ name: "testkit-scripted-harness" })
  .onRequest("initialize", ({ params }) => {
    writesThroughClient = params.clientCapabilities?.fs?.writeTextFile === true;
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: { loadSession: false },
      agentInfo: { name: "testkit-scripted-harness", version: "0.0.0" },
      authMethods: [],
    };
  })
  .onRequest("session/new", ({ params }) => {
    const sessionId = `session-${sessions.size + 1}`;
    sessions.set(sessionId, { cwd: params.cwd });
    const env = Object.entries(process.env).filter(([name]) => /^(OPENAI|ANTHROPIC)_/.test(name));
    log({ session: { cwd: params.cwd, env: Object.fromEntries(env) as Record<string, string> } });
    return { sessionId };
  })
  .onNotification("session/cancel", ({ params }) => {
    const waiting = sessions.get(params.sessionId)?.waiting;
    if (waiting && !waiting.ignoresCancel) waiting.wake("cancelled");
  })
  .onRequest(
    "_session/steering",
    (params: unknown) => params as { sessionId: string; prompt: ContentBlock[] },
    ({ params }) => {
      const prompt = textOf(params.prompt);
      const waiting = sessions.get(params.sessionId)?.waiting;
      const injected = waiting !== undefined && prompt.includes(waiting.text);
      log({ prompt, scripted: injected, steering: true });
      if (injected) waiting.wake("steered");
      return { outcome: injected ? "injected" : "failed" };
    },
  )
  .onRequest("session/prompt", async ({ params, client }) => {
    const prompt = textOf(params.prompt);
    const session = sessions.get(params.sessionId) ?? { cwd: process.cwd() };
    if (session.waiting && prompt.includes(session.waiting.text)) {
      log({ prompt, scripted: true });
      session.waiting.wake("steered");
      return { stopReason: "end_turn" };
    }
    const index = script.findIndex((turn, at) => !used.has(at) && prompt.includes(turn.when));
    log({ prompt, scripted: index >= 0 });
    const turn = script[index];
    if (!turn) return { stopReason: "refusal" };
    used.add(index);
    const allowed = await approveTools(client, params.sessionId, turn);
    if (turn.waitsFor !== undefined) {
      const text = turn.waitsFor;
      const how = await new Promise<string>((wake) => {
        session.waiting = { text, wake, ignoresCancel: turn.ignoresCancel === true };
      });
      session.waiting = undefined;
      if (how === "cancelled") return { stopReason: "cancelled" };
    }
    for (const [path, content] of Object.entries(allowed ? (turn.edits ?? {}) : {})) {
      const full = isAbsolute(path) ? path : resolve(session.cwd, path);
      if (writesThroughClient) {
        await client.request("fs/write_text_file", { sessionId: params.sessionId, path: full, content });
      } else {
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
      }
    }
    if (turn.reply) {
      await client.notify("session/update", {
        sessionId: params.sessionId,
        update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: turn.reply } },
      });
    }
    if (turn.costUsd !== undefined) {
      await client.notify("session/update", {
        sessionId: params.sessionId,
        update: { sessionUpdate: "usage_update", used: 0, size: 0, cost: { amount: turn.costUsd, currency: "USD" } },
      });
    }
    const usage = turn.usage && { ...turn.usage, totalTokens: turn.usage.inputTokens + turn.usage.outputTokens };
    return { stopReason: turn.stopReason ?? "end_turn", ...(usage ? { usage } : {}) };
  })
  .connect(
    ndJsonStream(
      Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
      Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
    ),
  );
