// A program the console runs, like a port's adapter (ADR 0073, ADR 0137) or `factory` (ADR 0141): its command line,
// its arguments and its standard input, and what it printed. A failure is a note with the program's error, never an
// exception.
import { execFile } from "node:child_process";

export type Outcome<T> = { ok: true; body: T } | { ok: false; usage: boolean; note: string };

/** Runs the command line with these arguments and this standard input, and reads what it printed with `read`. */
export function runProgram<T>(
  command: string,
  args: string[],
  read: (stdout: string) => T,
  input?: string,
): Promise<Outcome<T>> {
  const [file = "", ...words] = command.split(/\s+/);
  return new Promise((resolve) => {
    const child = execFile(file, [...words, ...args], (error, stdout, stderr) => {
      try {
        // A program names itself before its error, like "secrets-openbao: the store refused the token"; exit code 2
        // is a usage error, like a name it refuses.
        if (error) {
          const note =
            stderr
              .trim()
              .split("\n")[0]
              ?.replace(/^[\w-]+: /, "") || error.message;
          return resolve({ ok: false, usage: error.code === 2, note });
        }
        resolve({ ok: true, body: read(stdout) });
      } catch (failure) {
        resolve({ ok: false, usage: false, note: (failure as Error).message });
      }
    });
    // A program that ends before it reads its input closes the pipe; that is its error, not the console's.
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
  });
}
