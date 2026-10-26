// A stage's agent through the harness port (ADR 0050, ADR 0067): the adapter runs as a program that speaks ACP on
// stdio, and the foreman is its client. One session per stage, in the run's folder, with one prompt; a prompt sent
// while the turn runs is a steering message.
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { client, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";

export interface HarnessTurn {
  sessionId: string;
  /** The turn's stop reason, or "exited" when the adapter ended before the turn did. */
  done: Promise<string>;
  steer(text: string): void;
  cancel(): void;
  /** Hangs up and stops the adapter. */
  close(): Promise<void>;
}

export interface TurnOptions {
  /** The adapter's command line. */
  command: string;
  cwd: string;
  env: Record<string, string | undefined>;
  prompt: string;
}

export async function startTurn(options: TurnOptions): Promise<HarnessTurn> {
  const [file = "", ...args] = options.command.split(" ").filter(Boolean);
  const child = spawn(file, args, { cwd: options.cwd, env: options.env, stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const exited = new Promise<string>((resolve) => {
    child.on("exit", () => resolve("exited"));
    child.on("error", () => resolve("exited"));
  });
  const connection = client({ name: "opensoftware-foreman" })
    // The adapter refuses tool kinds outside its --allow list itself; the foreman allows the rest (ADR 0067).
    .onRequest("session/request_permission", ({ params }) => {
      const allow = params.options.find((option) => option.kind.startsWith("allow"));
      return { outcome: allow ? { outcome: "selected", optionId: allow.optionId } : { outcome: "cancelled" } };
    })
    .connect(
      ndJsonStream(
        Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
        Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
      ),
    );
  const { agent } = connection;
  const close = async () => {
    connection.close();
    child.stdin.end();
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1000))]);
    child.kill();
  };
  try {
    const handshake = (async () => {
      await agent.request("initialize", { protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
      return agent.request("session/new", { cwd: options.cwd, mcpServers: [] });
    })();
    const answer = await Promise.race([handshake, exited]);
    if (typeof answer === "string") throw new Error(`the harness ${options.command} exited: ${stderr.trim()}`);
    const { sessionId } = answer;
    const send = (text: string) => agent.request("session/prompt", { sessionId, prompt: [{ type: "text", text }] });
    const turn = send(options.prompt).then(
      ({ stopReason }) => stopReason as string,
      () => "exited",
    );
    return {
      sessionId,
      done: Promise.race([turn, exited]),
      steer: (text) => void send(text).catch(() => undefined),
      cancel: () => void agent.notify("session/cancel", { sessionId }).catch(() => undefined),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
