// A program with commands: help, the chosen command, its output and errors, and the exit code.
import { UsageError } from "./errors.ts";

/** What a command gives back. */
export interface Outcome {
  /** Written to standard output, one per line. */
  lines?: string[];
  /** Written to standard error, one per line, after the program's name. */
  errors?: string[];
  /** Default: 1 when there are errors, else 0. */
  exitCode?: number;
}

export type Command = () => Outcome | Promise<Outcome>;

export interface Program {
  /** The program's name. Every error line starts with it. */
  name: string;
  usage: string;
  /** The command the arguments chose, or undefined when they choose none or lack one it needs. */
  command: Command | undefined;
  /** The user asked for --help. */
  help?: boolean;
}

export interface Io {
  stdout: { write(text: string): unknown };
  stderr: { write(text: string): unknown };
}

/**
 * Runs the chosen command and returns the exit code: 0 on success, 1 when it fails, 2 for a usage error. --help
 * prints the usage and exits 0; no command prints it to standard error and exits 2.
 */
export async function runProgram(program: Program, io: Io = process): Promise<number> {
  const { name, usage, command, help = false } = program;
  if (help || !command) {
    (help ? io.stdout : io.stderr).write(usage);
    return help ? 0 : 2;
  }
  try {
    const { lines = [], errors = [], exitCode } = await command();
    for (const error of errors) io.stderr.write(`${name}: ${error}\n`);
    if (lines.length) io.stdout.write(`${lines.join("\n")}\n`);
    return exitCode ?? (errors.length ? 1 : 0);
  } catch (error) {
    io.stderr.write(`${name}: ${error instanceof Error ? error.message : String(error)}\n`);
    return error instanceof UsageError ? 2 : 1;
  }
}
