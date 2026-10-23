// The ACP proxy (ADR 0050): an ACP agent to its client on stdio and an ACP client to the agent it starts. It passes
// sessions, prompts, updates and cancels on, answers tool calls outside the allowlist itself, ends a cancelled turn
// within 5 seconds, and records every session in OSF_DATA.
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { type AgentConnection, agent, client, ndJsonStream, type PromptResponse } from "@agentclientprotocol/sdk";
import { type Allowlist, decisionOf, permits, refusal } from "../domain/allowlist.ts";
import { append, resourceOfEnvironment } from "./store.ts";

/** How long the agent has to end a cancelled turn before the adapter stops it. */
const CANCEL_DEADLINE_MS = 3000;

const streamOf = (output: Writable, input: Readable) =>
  ndJsonStream(
    Writable.toWeb(output) as WritableStream<Uint8Array>,
    Readable.toWeb(input) as ReadableStream<Uint8Array>,
  );

/** Runs the agent `command` behind the proxy; the process exits when the agent does. */
export function runProxy(command: string[], allowlist: Allowlist): Promise<never> {
  const [program, ...args] = command as [string, ...string[]];
  const child = spawn(program, args, { stdio: ["pipe", "pipe", "inherit"] });
  const running = new Map<string, number>();
  // Settles every running turn with "cancelled" when the adapter stops an agent that ignored a cancel.
  let stopAgent = (): void => undefined;
  const stopped = new Promise<PromptResponse>((resolve) => {
    stopAgent = () => resolve({ stopReason: "cancelled" });
  });
  const resource = resourceOfEnvironment();
  let agentInfo: { name?: string; version?: string } = {};
  let upstream: AgentConnection | undefined;

  const downstream = client()
    .onNotification("session/update", async ({ params }) => {
      append(params.sessionId, { type: "update", update: params.update });
      await (upstream as AgentConnection).client.notify("session/update", params);
    })
    .onRequest("session/request_permission", async ({ params }) => {
      const { title, kind } = params.toolCall;
      const line = { type: "permission", title, kind } as const;
      if (!permits(allowlist, kind)) {
        append(params.sessionId, { ...line, decision: "refused by the allowlist" });
        return { outcome: refusal(params.options) };
      }
      const answer = await (upstream as AgentConnection).client.request("session/request_permission", params);
      append(params.sessionId, { ...line, decision: decisionOf(params.options, answer.outcome) });
      return answer;
    })
    .connect(streamOf(child.stdin, child.stdout));
  const toAgent = downstream.agent;

  upstream = agent()
    .onRequest("initialize", async ({ params }) => {
      // The agent works in its folder itself: the adapter offers it no client file system and no terminal.
      const answer = await toAgent.request("initialize", { ...params, clientCapabilities: {} });
      agentInfo = answer.agentInfo ?? {};
      return answer;
    })
    .onRequest("session/new", async ({ params }) => {
      const answer = await toAgent.request("session/new", params);
      append(answer.sessionId, {
        type: "session",
        sessionId: answer.sessionId,
        cwd: params.cwd,
        agent: agentInfo,
        resource,
      });
      return answer;
    })
    .onRequest("session/prompt", async ({ params }) => {
      const { sessionId } = params;
      append(sessionId, { type: "prompt", prompt: params.prompt });
      running.set(sessionId, (running.get(sessionId) ?? 0) + 1);
      const answer = await Promise.race([toAgent.request("session/prompt", params), stopped]);
      running.set(sessionId, (running.get(sessionId) as number) - 1);
      append(sessionId, { type: "stop", stopReason: answer.stopReason });
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
    .connect(streamOf(process.stdout, process.stdin));

  // A client that hangs up ends the session: the agent stops, and so does the adapter.
  void upstream.closed.then(() => child.kill());
  // The adapter ends with its agent, after the answers to cancelled turns reached the client.
  child.on("exit", () => setTimeout(() => process.exit(0), 100));
  return new Promise<never>(() => undefined);
}
