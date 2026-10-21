// Runs a program the way a module's cli.ts does, and keeps what it writes.
import { type Command, runProgram } from "@opensoftware/cli";

export interface Ran {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runDemo(command: Command | undefined, options: { usage?: string; help?: boolean } = {}) {
  const ran: Ran = { exitCode: -1, stdout: "", stderr: "" };
  const io = {
    stdout: { write: (text: string) => (ran.stdout += text) },
    stderr: { write: (text: string) => (ran.stderr += text) },
  };
  const usage = options.usage ?? "Usage: demo <command>\n";
  ran.exitCode = await runProgram({ name: "demo", usage, command, help: options.help }, io);
  return ran;
}

/** The text of the lines, each ending with a newline. */
export const lines = (...texts: string[]): string => texts.map((text) => `${text}\n`).join("");
