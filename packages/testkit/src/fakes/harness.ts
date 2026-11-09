// A scripted coding agent that speaks ACP on stdio (ADR 0018). The module starts it like any ACP agent; the agent
// performs the scripted file edits and commands and ends each turn. A prompt that matches no turn fails the scenario.
// For containers, the agent runs with the container's node and names the folders the container must mount (ADR 0076).
// For sandboxes, which mount nothing, it takes its script from the testkit and sends its log to it over HTTP (ADR 0096).
import { appendFileSync, chmodSync, existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { StopReason, ToolKind } from "@agentclientprotocol/sdk";
import { tempFolder } from "../support/temp.ts";
import { HARNESS_AGENT as AGENT } from "./harness-agent-file.ts";

export interface HarnessTool {
  /** The title of the tool call, for example "rm -rf build". */
  title: string;
  /** Its ACP tool kind, for example "execute" or "edit". */
  kind: ToolKind;
}

export interface HarnessTurn {
  /** The turn matches the first prompt whose text contains this. Each turn answers once. */
  when: string;
  /** Files the agent writes, by path relative to the session's working folder. */
  edits?: Record<string, string>;
  /**
   * Shell commands the agent runs after the edits, one after the other, in the session's working folder with `sh -c`
   * (ADR 0076). Their output is part of the reply. A command that exits with another code than 0 ends the turn with
   * "refusal" and fails the scenario with its output.
   */
  commands?: string[];
  /** Text the agent streams as its message before it ends the turn. */
  reply?: string;
  /**
   * Tool calls the agent asks the client to approve, in order, before the edits (ADR 0050). The edits are written
   * only when the client allowed every one.
   */
  tools?: HarnessTool[];
  /**
   * The turn keeps running until the session gets a prompt that contains this text, a steering message, which ends
   * at once. Then the turn goes on. A cancel of the session ends the waiting turn with "cancelled".
   */
  waitsFor?: string;
  /** The waiting turn ignores a cancel of the session and keeps running. */
  ignoresCancel?: boolean;
  /** The stop reason that ends the turn; "end_turn" by default. */
  stopReason?: StopReason;
  /** The token usage the agent reports in its answer to the prompt (ADR 0052). */
  usage?: { inputTokens: number; outputTokens: number };
  /** The session's cost so far in USD, which the agent reports in a `usage_update` before the turn ends. */
  costUsd?: number;
}

export interface HarnessToolCall extends HarnessTool {
  /** Whether the client allowed the tool call or refused it. */
  outcome: "allowed" | "refused";
}

/** A command of a turn the agent ran, with its exit code and its output. */
export interface HarnessCommand {
  command: string;
  exitCode: number;
  output: string;
}

/** A session the agent opened: its folder and the model and effort variables of its environment (ADR 0070, 0078). */
export interface HarnessSession {
  cwd: string;
  /** The variables `OPENAI_*`, `ANTHROPIC_*`, `OSF_EFFORT` and `TRACEPARENT` the agent got, by name. */
  env: Record<string, string>;
}

export interface Harness {
  /** Start the agent with this command and these arguments; it speaks ACP on stdin and stdout. */
  command: string;
  args: string[];
  /** The text of every prompt the agent received, in order, steering messages included. */
  prompts(): string[];
  /** The text of every steering message the agent received as the request `_session/steering`, in order. */
  steeringRequests(): string[];
  /** Every tool call the agent asked to approve, with the client's answer, in order. */
  toolCalls(): HarnessToolCall[];
  /** Every session the agent opened, in order. */
  sessions(): HarnessSession[];
  /** Every command the agent ran, in order. */
  commands(): HarnessCommand[];
  /**
   * With `containers: true`, the folders a container must mount at the same path to run the agent: the agent's code
   * with its dependencies, and the folder of its script and log, which the container's user may write.
   */
  mounts?: string[];
}

export interface HarnessOptions {
  /**
   * The module runs the agent in a container: the command is the container's `node`, and `mounts` names the folders
   * of the host the container needs. Default false.
   */
  containers?: boolean;
  /**
   * The module runs the agent in a sandbox, which mounts no folder of the host: the sandbox's template holds the agent
   * file `HARNESS_AGENT` at `agent`, with the ACP SDK where the file finds it. The agent takes its script from the
   * testkit and sends its log to it over HTTP at `host.docker.internal`, through the sandbox's egress proxy, so the
   * sandbox's egress must allow that host. Default: none.
   */
  sandboxes?: { agent: string };
}

/** One line of the agent's log: a prompt it received, a tool call it asked to approve, or a session it opened. */
export type HarnessLogEntry =
  | { prompt: string; scripted: boolean; steering?: true }
  | { tool: HarnessToolCall }
  | { command: HarnessCommand }
  | { session: HarnessSession };

/** The deepest folder that holds both paths. */
function commonFolder(a: string, b: string): string {
  const left = a.split(sep);
  const right = b.split(sep);
  let at = 0;
  while (at < left.length && left[at] === right[at]) at++;
  return left.slice(0, at).join(sep) || sep;
}

/** The folder that holds the agent and the ACP SDK it imports, as their real paths. */
function agentFolder(): string {
  const sdk = realpathSync(dirname(fileURLToPath(import.meta.resolve("@agentclientprotocol/sdk"))));
  return commonFolder(realpathSync(dirname(AGENT)), sdk);
}

/** Serves the script at /script and appends each line posted to /log, for an agent in a sandbox; its port. */
async function serveScript(script: HarnessTurn[], logFile: string): Promise<{ port: number; close(): Promise<void> }> {
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/script") {
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(script));
      return;
    }
    if (request.method !== "POST" || request.url !== "/log") {
      response.writeHead(404).end();
      return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      appendFileSync(logFile, `${body}\n`);
      response.writeHead(204).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** The agent's command line: in a sandbox the template's agent with the testkit's URLs, else this agent's files. */
function commandOf(options: HarnessOptions, scriptFile: string, logFile: string, port?: number) {
  if (options.sandboxes) {
    const url = `http://host.docker.internal:${port}`;
    // Node's fetch takes the sandbox's egress proxy from HTTP_PROXY only with NODE_USE_ENV_PROXY.
    return {
      command: "env",
      args: ["NODE_USE_ENV_PROXY=1", "node", options.sandboxes.agent, `${url}/script`, `${url}/log`],
    };
  }
  return { command: options.containers ? "node" : process.execPath, args: [AGENT, scriptFile, logFile] };
}

export async function startHarness(
  script: HarnessTurn[],
  options: HarnessOptions = {},
): Promise<{ harness: Harness; close(): Promise<string[]> }> {
  const dir = tempFolder("osf-harness-");
  const scriptFile = join(dir, "script.json");
  const logFile = join(dir, "log.jsonl");
  writeFileSync(scriptFile, JSON.stringify(script));
  // The container's user is another than the test's: it may read the script and write the log.
  if (options.containers) chmodSync(dir, 0o777);
  const server = options.sandboxes ? await serveScript(script, logFile) : undefined;
  const entries = (): HarnessLogEntry[] =>
    existsSync(logFile)
      ? readFileSync(logFile, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];
  const prompts = () => entries().flatMap((entry) => ("prompt" in entry ? [entry] : []));
  return {
    harness: {
      ...commandOf(options, scriptFile, logFile, server?.port),
      ...(options.containers ? { mounts: [agentFolder(), dir] } : {}),
      prompts: () => prompts().map((entry) => entry.prompt),
      steeringRequests: () => prompts().flatMap((entry) => (entry.steering ? [entry.prompt] : [])),
      toolCalls: () => entries().flatMap((entry) => ("tool" in entry ? [entry.tool] : [])),
      sessions: () => entries().flatMap((entry) => ("session" in entry ? [entry.session] : [])),
      commands: () => entries().flatMap((entry) => ("command" in entry ? [entry.command] : [])),
    },
    async close() {
      await server?.close();
      const failed = entries()
        .flatMap((entry) => ("command" in entry && entry.command.exitCode !== 0 ? [entry.command] : []))
        .map(({ command, exitCode, output }) => `harness command failed with ${exitCode}: ${command}\n${output}`);
      const problems = prompts()
        .filter((entry) => !entry.scripted)
        .map((entry) => `unscripted harness prompt:\n${entry.prompt}`)
        .concat(failed);
      rmSync(dir, { recursive: true, force: true });
      return problems;
    },
  };
}
