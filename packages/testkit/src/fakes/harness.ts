// A scripted coding agent that speaks ACP on stdio (ADR 0018). The module starts it like any ACP agent; the agent
// performs the scripted file edits and ends each turn. A prompt that matches no turn fails the scenario.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
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
}

/** One line of the agent's log: a prompt it received, a tool call it asked to approve, or a session it opened. */
export type HarnessLogEntry =
  | { prompt: string; scripted: boolean; steering?: true }
  | { tool: HarnessToolCall }
  | { session: HarnessSession };

// Next to this file in the source tree and in the built package alike.
const AGENT = fileURLToPath(new URL(`./harness-agent${extname(fileURLToPath(import.meta.url))}`, import.meta.url));

export function startHarness(script: HarnessTurn[]): { harness: Harness; close(): Promise<string[]> } {
  const dir = mkdtempSync(join(tmpdir(), "osf-harness-"));
  const scriptFile = join(dir, "script.json");
  const logFile = join(dir, "log.jsonl");
  writeFileSync(scriptFile, JSON.stringify(script));
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
      command: process.execPath,
      args: [AGENT, scriptFile, logFile],
      prompts: () => prompts().map((entry) => entry.prompt),
      steeringRequests: () => prompts().flatMap((entry) => (entry.steering ? [entry.prompt] : [])),
      toolCalls: () => entries().flatMap((entry) => ("tool" in entry ? [entry.tool] : [])),
      sessions: () => entries().flatMap((entry) => ("session" in entry ? [entry.session] : [])),
    },
    async close() {
      const problems = prompts()
        .filter((entry) => !entry.scripted)
        .map((entry) => `unscripted harness prompt:\n${entry.prompt}`);
      rmSync(dir, { recursive: true, force: true });
      return problems;
    },
  };
}
