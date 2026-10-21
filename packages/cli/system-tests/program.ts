// Runs a program the way a module's cli.ts does, and keeps what it writes.
import type { Command, Io, Program } from "@opensoftware/cli";

export interface Ran {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** The program "demo" with the command, its usage and --help. */
export function demo(command: Command | undefined, options: { usage?: string; help?: boolean } = {}): Program {
  return { name: "demo", usage: options.usage ?? "Usage: demo <command>\n", command, help: options.help };
}

/** Runs `run` with an io that keeps standard output and error. */
export async function capture(run: (io: Io) => Promise<number>): Promise<Ran> {
  const ran: Ran = { exitCode: -1, stdout: "", stderr: "" };
  ran.exitCode = await run({
    stdout: { write: (text: string) => (ran.stdout += text) },
    stderr: { write: (text: string) => (ran.stderr += text) },
  });
  return ran;
}

/** The text of the lines, each ending with a newline. */
export const lines = (...texts: string[]): string => texts.map((text) => `${text}\n`).join("");
