// A scripted coding agent that speaks ACP on stdio (ADR 0018). The module starts it like any ACP agent; the agent
// performs the scripted file edits and commands and ends each turn. A prompt that matches no turn fails the scenario.
// For containers, the agent runs with the container's node and names the folders the container must mount (ADR 0076).
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { StopReason, ToolKind } from "@agentclientprotocol/sdk";

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

/** A session the agent opened: its folder and the model variables of the agent's environment (ADR 0070). */
export interface HarnessSession {
  cwd: string;
  /** The variables `OPENAI_*` and `ANTHROPIC_*` the agent got, by name. */
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
}

/** One line of the agent's log: a prompt it received, a tool call it asked to approve, or a session it opened. */
export type HarnessLogEntry =
  | { prompt: string; scripted: boolean; steering?: true }
  | { tool: HarnessToolCall }
  | { command: HarnessCommand }
  | { session: HarnessSession };

// Next to this file in the source tree and in the built package alike.
const AGENT = fileURLToPath(new URL(`./harness-agent${extname(fileURLToPath(import.meta.url))}`, import.meta.url));

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

export function startHarness(
  script: HarnessTurn[],
  options: HarnessOptions = {},
): { harness: Harness; close(): Promise<string[]> } {
  const dir = mkdtempSync(join(tmpdir(), "osf-harness-"));
  const scriptFile = join(dir, "script.json");
  const logFile = join(dir, "log.jsonl");
  writeFileSync(scriptFile, JSON.stringify(script));
  // The container's user is another than the test's: it may read the script and write the log.
  if (options.containers) chmodSync(dir, 0o777);
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
      command: options.containers ? "node" : process.execPath,
      args: [AGENT, scriptFile, logFile],
      ...(options.containers ? { mounts: [agentFolder(), dir] } : {}),
      prompts: () => prompts().map((entry) => entry.prompt),
      steeringRequests: () => prompts().flatMap((entry) => (entry.steering ? [entry.prompt] : [])),
      toolCalls: () => entries().flatMap((entry) => ("tool" in entry ? [entry.tool] : [])),
      sessions: () => entries().flatMap((entry) => ("session" in entry ? [entry.session] : [])),
      commands: () => entries().flatMap((entry) => ("command" in entry ? [entry.command] : [])),
    },
    async close() {
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
