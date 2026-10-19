// A scripted coding agent that speaks ACP on stdio (ADR 0018). The module starts it like any ACP agent; the agent
// performs the scripted file edits and ends each turn. A prompt that matches no turn fails the scenario.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface HarnessTurn {
  /** The turn matches the first prompt whose text contains this. Each turn answers once. */
  when: string;
  /** Files the agent writes, by path relative to the session's working folder. */
  edits?: Record<string, string>;
  /** Text the agent streams as its message before it ends the turn. */
  reply?: string;
}

export interface Harness {
  /** Start the agent with this command and these arguments; it speaks ACP on stdin and stdout. */
  command: string;
  args: string[];
  /** The text of every prompt the agent received, in order. */
  prompts(): string[];
}

// Next to this file in the source tree and in the built package alike.
const AGENT = fileURLToPath(new URL(`./harness-agent${extname(fileURLToPath(import.meta.url))}`, import.meta.url));

export function startHarness(script: HarnessTurn[]): { harness: Harness; close(): Promise<string[]> } {
  const dir = mkdtempSync(join(tmpdir(), "osf-harness-"));
  const scriptFile = join(dir, "script.json");
  const logFile = join(dir, "log.jsonl");
  writeFileSync(scriptFile, JSON.stringify(script));
  const entries = (): { prompt: string; scripted: boolean }[] =>
    existsSync(logFile)
      ? readFileSync(logFile, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];
  return {
    harness: {
      command: process.execPath,
      args: [AGENT, scriptFile, logFile],
      prompts: () => entries().map((entry) => entry.prompt),
    },
    async close() {
      const problems = entries()
        .filter((entry) => !entry.scripted)
        .map((entry) => `unscripted harness prompt:\n${entry.prompt}`);
      rmSync(dir, { recursive: true, force: true });
      return problems;
    },
  };
}
