// The ACP proxy (ADR 0050): an ACP agent to its client and an ACP client to the agent it starts. It passes sessions,
// prompts, updates and cancels on, answers tool calls outside the allowlist itself, ends a cancelled turn within 5
// seconds, and records every session in the data folder.
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
  type AgentConnection,
  agent,
  client,
  type NewSessionRequest,
  ndJsonStream,
  type PromptResponse,
} from "@agentclientprotocol/sdk";
import { type Allowlist, decisionOf, permits, refusal } from "./domain/allowlist.ts";
import { append, resourceOfEnvironment } from "./store.ts";

/** How long the agent has to end a cancelled turn before the proxy stops it. */
const CANCEL_DEADLINE_MS = 3000;

export interface ProxyOptions {
  /** The ACP agent to start: its program, its arguments and the variables it gets on top of this process's. */
  agent: { command: string; args: string[]; env?: Record<string, string> };
  /** The ACP tool kinds the client may approve; without it, the client decides every tool call. */
  allow?: Allowlist;
  /** The folder the sessions are recorded in, as sessions/<session ID>.jsonl. */
  data: string;
  /** The resource attributes of the run; by default from OTEL_RESOURCE_ATTRIBUTES and OTEL_SERVICE_NAME. */
  resource?: Record<string, string>;
  /** Changes each `session/new` request of the client before the agent gets it. */
  newSession?: (params: NewSessionRequest) => NewSessionRequest;
  /** The client's side: the stream the proxy reads the client from and the one it writes to. Default: stdio. */
  io?: { input: Readable; output: Writable };
}

const streamOf = (output: Writable, input: Readable) =>
  ndJsonStream(
    Writable.toWeb(output) as WritableStream<Uint8Array>,
    Readable.toWeb(input) as ReadableStream<Uint8Array>,
  );

/** Runs the agent behind the proxy; the promise resolves when the agent has exited. */
export function serveProxy(options: ProxyOptions): Promise<void> {
  const { command, args, env } = options.agent;
  const { input, output } = options.io ?? { input: process.stdin, output: process.stdout };
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "inherit"], env: { ...process.env, ...env } });
  const record = append.bind(undefined, options.data);
  const running = new Map<string, number>();
  // Settles every running turn with "cancelled" when the proxy stops an agent that ignored a cancel.
  let stopAgent = (): void => undefined;
  const stopped = new Promise<PromptResponse>((resolve) => {
    stopAgent = () => resolve({ stopReason: "cancelled" });
  });
  const resource = options.resource ?? resourceOfEnvironment();
  let agentInfo: { name?: string; version?: string } = {};
  let upstream: AgentConnection | undefined;

  const downstream = client()
    .onNotification("session/update", async ({ params }) => {
      record(params.sessionId, { type: "update", update: params.update });
      await (upstream as AgentConnection).client.notify("session/update", params);
    })
    .onRequest("session/request_permission", async ({ params }) => {
      const { title, kind } = params.toolCall;
      const line = { type: "permission", title, kind } as const;
      if (!permits(options.allow, kind)) {
        record(params.sessionId, { ...line, decision: "refused by the allowlist" });
        return { outcome: refusal(params.options) };
      }
      const answer = await (upstream as AgentConnection).client.request("session/request_permission", params);
      record(params.sessionId, { ...line, decision: decisionOf(params.options, answer.outcome) });
      return answer;
    })
    .connect(streamOf(child.stdin, child.stdout));
  const toAgent = downstream.agent;

  upstream = agent()
    .onRequest("initialize", async ({ params }) => {
      // The agent works in its folder itself: the proxy offers it no client file system and no terminal.
      const answer = await toAgent.request("initialize", { ...params, clientCapabilities: {} });
      agentInfo = answer.agentInfo ?? {};
      return answer;
    })
    .onRequest("session/new", async ({ params }) => {
      const request = options.newSession ? options.newSession(params) : params;
      const answer = await toAgent.request("session/new", request);
      record(answer.sessionId, {
        type: "session",
        sessionId: answer.sessionId,
        cwd: request.cwd,
        agent: agentInfo,
        resource,
      });
      return answer;
    })
    .onRequest("session/prompt", async ({ params }) => {
      const { sessionId } = params;
      record(sessionId, { type: "prompt", prompt: params.prompt });
      running.set(sessionId, (running.get(sessionId) ?? 0) + 1);
      const answer = await Promise.race([toAgent.request("session/prompt", params), stopped]);
      running.set(sessionId, (running.get(sessionId) as number) - 1);
      record(sessionId, {
        type: "stop",
        stopReason: answer.stopReason,
        ...(answer.usage ? { usage: answer.usage } : {}),
      });
      return answer;
    })
    .onNotification("session/cancel", async ({ params }) => {
      await toAgent.notify("session/cancel", params);
      setTimeout(() => {
        if (!running.get(params.sessionId)) return;
        stopAgent();
        child.kill("SIGKILL");
      }, CANCEL_DEADLINE_MS).unref();
    })
    .connect(streamOf(output, input));

  // A client that hangs up ends the session: the agent stops, and so does the proxy.
  void upstream.closed.then(() => child.kill());
  // The proxy ends with its agent, after the answers to cancelled turns reached the client.
  return new Promise<void>((resolve) => child.on("exit", () => setTimeout(resolve, 100)));
}
