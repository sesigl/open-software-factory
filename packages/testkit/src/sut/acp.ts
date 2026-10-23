// sut.acp: the module as an ACP agent over stdio, driven by the official ACP client (ADR 0050).
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync } from "node:fs";
import { PassThrough, Readable, Writable } from "node:stream";
import { client, ndJsonStream, PROTOCOL_VERSION, type StopReason, type ToolKind } from "@agentclientprotocol/sdk";
import type { Launch } from "./launch.ts";

export interface AcpTurn {
  /** How the turn ended, for example "end_turn" or "cancelled". */
  stopReason: StopReason;
  /** The text the agent streamed in the session while the turn ran. */
  reply: string;
}

export interface AcpSession {
  /** The session ID the agent chose. */
  id: string;
  /** Sends a prompt and waits for the end of its turn. Send another one before that to steer the running turn. */
  prompt(text: string): Promise<AcpTurn>;
  /** Cancels the running turn of the session. */
  cancel(): Promise<void>;
}

export interface AcpPermissionRequest {
  sessionId: string;
  title: string;
  kind?: ToolKind;
}

export interface AcpClient {
  /** The name and version the agent gave in its answer to `initialize`. */
  agent: { name?: string; version?: string };
  /** Starts a session in a folder below $INPUT or $OUTPUT, by default $INPUT. */
  newSession(cwd?: string): Promise<AcpSession>;
  /** Every tool call the agent asked the client to approve, in order. */
  permissionRequests(): AcpPermissionRequest[];
  /** Waits until the module's process exits and gives its exit code. */
  exited(): Promise<number | null>;
}

export interface Acp {
  /**
   * Starts the module's artifact with these arguments as an ACP agent on stdio and returns a connected client. The
   * client approves every tool call the agent asks about, or refuses each one with `approve: false`. It offers the
   * agent no file system and no terminal. The agent stops when the scenario ends.
   */
  connect(args?: string[], options?: { env?: Record<string, string>; approve?: boolean }): Promise<AcpClient>;
  /**
   * Runs an ACP agent in the test's own process, for a library (ADR 0039, ADR 0051): `start` gets the agent's side
   * of a pair of streams and returns a promise that settles when the agent ends. The client is the one `connect`
   * gives; `exited` gives 0 when that promise resolves and 1 when it rejects.
   */
  serve(start: (io: AcpStreams) => Promise<unknown>, options?: { approve?: boolean }): Promise<AcpClient>;
}

/** The agent's side of an in-process ACP connection: it reads the client's messages and writes its own. */
export interface AcpStreams {
  input: Readable;
  output: Writable;
}

export function makeAcp(
  launch: Launch,
  onStop: (stop: () => Promise<unknown>) => void,
  inside: (path: string) => string,
): Acp {
  return {
    async connect(args = [], options = {}) {
      const { command, argv, cwd, env } = launch(args, options.env);
      const child = spawn(command, argv, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
      const exit = once(child, "exit").then(([code]) => code as number | null);
      let stderr = "";
      child.stderr.on("data", (chunk) => (stderr += chunk));
      return connectClient({ input: child.stdout, output: child.stdin }, exit, () => stderr, options.approve, {
        onStop: (hangUp) =>
          onStop(async () => {
            hangUp();
            child.stdin.end();
            await Promise.race([exit, new Promise((resolve) => setTimeout(resolve, 1000))]);
            child.kill();
          }),
        inside,
      });
    },
    async serve(start, options = {}) {
      const toAgent = new PassThrough();
      const toClient = new PassThrough();
      const exit = Promise.resolve()
        .then(() => start({ input: toAgent, output: toClient }))
        .then(
          () => 0,
          () => 1,
        );
      return connectClient({ input: toClient, output: toAgent }, exit, () => "", options.approve, {
        onStop: (hangUp) =>
          onStop(async () => {
            hangUp();
            toAgent.end();
            await Promise.race([exit, new Promise((resolve) => setTimeout(resolve, 1000))]);
          }),
        inside,
      });
    },
  };
}

/** The client's side: the streams it reads the agent from and writes the agent to. */
interface ClientStreams {
  input: Readable;
  output: Writable;
}

async function connectClient(
  streams: ClientStreams,
  exit: Promise<number | null>,
  stderr: () => string,
  approve: boolean | undefined,
  hooks: { onStop(hangUp: () => void): void; inside: (path: string) => string },
): Promise<AcpClient> {
  const listeners = new Map<string, Set<(text: string) => void>>();
  const requests: AcpPermissionRequest[] = [];
  const wanted = approve === false ? "reject" : "allow";
  const connection = client({ name: "opensoftware-testkit" })
    .onNotification("session/update", ({ params }) => {
      const { update } = params;
      if (update.sessionUpdate !== "agent_message_chunk" || update.content.type !== "text") return;
      for (const listen of listeners.get(params.sessionId) ?? []) listen(update.content.text);
    })
    .onRequest("session/request_permission", ({ params }) => {
      const { toolCall } = params;
      requests.push({ sessionId: params.sessionId, title: toolCall.title ?? "", kind: toolCall.kind ?? undefined });
      const option = params.options.find((candidate) => candidate.kind.startsWith(wanted));
      return { outcome: option ? { outcome: "selected", optionId: option.optionId } : { outcome: "cancelled" } };
    })
    .connect(
      ndJsonStream(
        Writable.toWeb(streams.output) as WritableStream<Uint8Array>,
        Readable.toWeb(streams.input) as ReadableStream<Uint8Array>,
      ),
    );
  // Hang up first and give the module a second to stop on its own, as a client that ends would.
  hooks.onStop(() => connection.close());
  const { agent } = connection;
  const failed = (what: string, error: unknown): Error =>
    new Error(`sut.acp: ${what}: ${error instanceof Error ? error.message : String(error)}\n${stderr()}`);
  const initialized = await agent
    .request("initialize", { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    .catch((error: unknown) => {
      throw failed("the module did not answer the ACP handshake", error);
    });
  return {
    agent: { name: initialized.agentInfo?.name, version: initialized.agentInfo?.version },
    permissionRequests: () => [...requests],
    exited: () => exit,
    async newSession(folder = "$INPUT") {
      const sessionCwd = hooks.inside(folder);
      mkdirSync(sessionCwd, { recursive: true });
      const { sessionId } = await agent.request("session/new", { cwd: sessionCwd, mcpServers: [] });
      const own = listeners.get(sessionId) ?? new Set();
      listeners.set(sessionId, own);
      return {
        id: sessionId,
        async prompt(text) {
          let reply = "";
          const listen = (chunk: string): void => {
            reply += chunk;
          };
          own.add(listen);
          try {
            const { stopReason } = await agent
              .request("session/prompt", { sessionId, prompt: [{ type: "text", text }] })
              .catch((error: unknown) => {
                throw failed(`the prompt "${text}" failed`, error);
              });
            return { stopReason, reply };
          } finally {
            own.delete(listen);
          }
        },
        cancel: () => agent.notify("session/cancel", { sessionId }),
      };
    },
  };
}
