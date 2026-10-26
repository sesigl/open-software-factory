// An adapter of a port that is a program (ADR 0054, ADR 0056): the foreman runs one of its commands and reads what it
// printed.
import { execFile } from "node:child_process";

/**
 * Runs commands of the `port`'s adapter and resolves with what it printed, trimmed; a failure names the port, the command
 * and what the adapter wrote to standard error.
 */
export function adapterRun(port: string, adapter: string[], env: Record<string, string | undefined>) {
  const [file, ...args] = adapter as [string, ...string[]];
  return (...command: string[]) =>
    new Promise<string>((resolve, reject) => {
      execFile(file, [...args, ...command], { env }, (error, stdout, stderr) => {
        if (error) reject(new Error(`the ${port} adapter's ${command[0]} failed: ${stderr.trim() || error.message}`));
        else resolve(stdout.trim());
      });
    });
}

/** The last line an adapter printed. */
export const lastLine = (printed: string): string => printed.split("\n").pop() as string;
