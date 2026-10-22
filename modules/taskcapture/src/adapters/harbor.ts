// Starts the harbor CLI as a separate process (ADR 0045). Its output goes to standard error, so standard output
// keeps only taskcapture's own lines.
import { spawn } from "node:child_process";

/** Runs `command` (words separated by spaces, like "uvx harbor") with the arguments; resolves to its exit code. */
export function runHarbor(command: string, args: string[]): Promise<number> {
  const [program, ...words] = command.trim().split(/\s+/);
  return new Promise((resolve, reject) => {
    const child = spawn(program as string, [...words, ...args], { stdio: ["ignore", process.stderr, process.stderr] });
    child.on("error", (error) =>
      reject(
        new Error(
          `could not start ${command} (${(error as NodeJS.ErrnoException).code}); install it with "uv tool install harbor" or set TASKCAPTURE_HARBOR`,
        ),
      ),
    );
    child.on("close", (code) => resolve(code ?? 1));
  });
}
